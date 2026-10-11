"""Real HTTP acceptance checks; only the disposable inventory sandbox is allowed."""
import asyncio
import os
from uuid import uuid4
from urllib.parse import quote, urlparse

import httpx


async def main():
    url = os.environ.get('INVENTORY_SANDBOX_URL', '')
    parsed = urlparse(url)
    assert parsed.scheme == 'http' and parsed.hostname == '127.0.0.1' and parsed.port == 58002, 'Disposable loopback sandbox required'
    async with httpx.AsyncClient(base_url=url, timeout=30) as client:
        reset = await client.post('/__sandbox/reset')
        assert reset.status_code == 200, reset.text
        state = reset.json()
        assert state['sandbox'] and state['schema'].startswith('inventory_browser_test_')
        admin = {'Authorization': 'Bearer ' + state['access_token']}
        master = {'Authorization': 'Bearer ' + state['master_access_token']}
        poster = {'Authorization': 'Bearer ' + state['poster_access_token']}
        root = '/api/v1/backoffice/inventory'
        passed = []

        async def call(method, path, expected=200, actor=master, key=None, body=None):
            headers = dict(actor)
            if key:
                headers['Idempotency-Key'] = key
            response = await client.request(method, root + path, headers=headers, json=body)
            assert response.status_code == expected, (method, path, response.status_code, response.text)
            return response.json() if response.content else None

        async def lookup(code, expected=200):
            return await call('GET', '/products/barcode/' + quote(code, safe=''), expected)

        await call('GET', '/stock', 401, actor={})
        await call('GET', '/stock', 401, actor={'Authorization': 'Bearer ' + state['inactive_access_token']})
        me = await client.get('/api/v1/backoffice/auth/me', headers=master)
        assert me.json()['role'] == 'barber' and me.json()['can_post_inventory'] is False
        assert (await client.get('/api/v1/backoffice/auth/me', headers=poster)).json()['can_post_inventory'] is True
        passed.append('real auth: master, posting master, anonymous and inactive')

        product = state['seed']['products']['missing_barcode']
        known = state['seed']['products']['available']
        found = await lookup(known['barcode'])
        assert found['id'] == known['id'] and found['on_hand'] == 10 and found['available'] == 8
        code = ' 00123AbC '
        await lookup(code, 404)
        for term in (product['name'], product['sku']):
            result = await call('GET', '/stock?search=' + quote(term))
            assert product['id'] in [item['id'] for item in result['items']]
        bound = await call('PUT', f"/products/{product['id']}/barcode", body={'barcode': code})
        assert bound['barcode'] == code and bound['on_hand'] == product['on_hand']
        assert bound['barcode_bound_by_user_id'] == state['master_user']['id']
        assert (await lookup(code))['id'] == product['id']
        assert (await call('PUT', f"/products/{product['id']}/barcode", body={'barcode': code}))['on_hand'] == 4
        await lookup(code.upper(), 404)
        await call('PUT', f"/products/{product['id']}/barcode", 409, body={'barcode': 'DIFFERENT'})
        await call('PUT', f"/products/{state['seed']['products']['out_of_stock']['id']}/barcode", 409, body={'barcode': code})
        assert (await lookup(code))['on_hand'] == 4
        passed.append('found/unknown exact barcode, name/SKU search, binding, conflict and unchanged stock')

        payload = {'name': 'Acceptance new shampoo', 'barcode': '5901234123457', 'sku': 'REAL-MOBILE-NEW', 'price': '123.45', 'package_size': '250 ml'}
        key = 'card-' + uuid4().hex
        cards = await asyncio.gather(*[call('POST', '/products', 201, key=key, body=payload) for _ in range(2)])
        card = cards[0]
        assert cards[0]['id'] == cards[1]['id'] and card['on_hand'] == card['reserved'] == card['available'] == 0
        assert card['created_by_user_id'] == state['master_user']['id']
        detail = await client.get(f"/api/v1/backoffice/products/{card['id']}", headers=master)
        assert detail.status_code == 200 and detail.json()['is_active'] is False
        assert detail.json()['price'] == '123.45'
        await call('POST', '/products', 409, key=key, body={**payload, 'name': 'Changed'})
        await call('POST', '/products', 409, key='sku-' + uuid4().hex, body={**payload, 'barcode': '96385074'})
        passed.append('concurrent product creation replay, hidden zero stock, retail price, payload/SKU conflicts')

        receipt_key = 'draft-' + uuid4().hex
        receipt_body = {'reason': 'Real mobile acceptance', 'comment': 'Synthetic only'}
        receipt = await call('POST', '/receipts', 201, key=receipt_key, body=receipt_body)
        assert (await call('POST', '/receipts', 201, key=receipt_key, body=receipt_body))['id'] == receipt['id']
        await call('POST', '/receipts', 409, key=receipt_key, body={**receipt_body, 'reason': 'Changed'})
        rid = receipt['id']
        item = {'product_id': product['id'], 'quantity': 3, 'purchase_unit_cost': '24.50'}
        item_key = 'item-' + uuid4().hex
        first = await call('POST', f'/receipts/{rid}/items', key=item_key, body=item)
        replay = await call('POST', f'/receipts/{rid}/items', key=item_key, body=item)
        assert first['items'] == replay['items'] and replay['items'][0]['quantity'] == 3
        await call('POST', f'/receipts/{rid}/items', 409, key=item_key, body={**item, 'quantity': 9})
        intentional = await call('POST', f'/receipts/{rid}/items', key='intent-' + uuid4().hex, body={**item, 'quantity': 1})
        assert sum(row['quantity'] for row in intentional['items']) == 4
        assert intentional['status'] == 'draft' and (await lookup(code))['on_hand'] == 4
        await call('POST', f'/receipts/{rid}/post', 403, key='denied-' + uuid4().hex)
        assert (await lookup(code))['on_hand'] == 4
        passed.append('draft/item immutable replay, intentional quantity increase, master posting denied')

        before = (await client.get('/__sandbox/inspect')).json()['movement_count']
        posted = await asyncio.gather(*[call('POST', f'/receipts/{rid}/post', actor=poster, key='post-' + uuid4().hex) for _ in range(2)])
        assert all(document['status'] == 'posted' for document in posted)
        await call('POST', f'/receipts/{rid}/post', actor=admin, key='post-again-' + uuid4().hex)
        # Retry original committed item is safe even after posting.
        after_item = await call('POST', f'/receipts/{rid}/items', key=item_key, body=item)
        assert after_item['status'] == 'posted'
        balance = await lookup(code)
        assert (balance['on_hand'], balance['reserved'], balance['available']) == (8, 0, 8)
        after = (await client.get('/__sandbox/inspect')).json()['movement_count']
        assert after == before + len(intentional['items']), (before, after, intentional['items'])
        await call('POST', f'/receipts/{rid}/items', 409, key='new-after-post-' + uuid4().hex, body=item)
        passed.append('concurrent posting and post/item replays update stock and movement ledger exactly once')

        permission_path = f"/users/{state['master_user']['id']}/permissions"
        await call('PATCH', permission_path, 403, body={'can_post_inventory': True})
        await call('PATCH', permission_path, actor=admin, body={'can_post_inventory': True})
        assert (await client.get('/api/v1/backoffice/auth/me', headers=master)).json()['can_post_inventory'] is True
        await call('PATCH', permission_path, actor=admin, body={'can_post_inventory': False})
        await call('POST', f'/receipts/{rid}/post', 403, key='after-revoke-' + uuid4().hex)
        passed.append('only superuser grants/revokes posting; server enforces revoked permission')
        for result in passed:
            print('PASS:', result)
        print(f'{len(passed)} real HTTP acceptance groups passed; schema={state["schema"]}')


if __name__ == '__main__':
    asyncio.run(main())
