"""Start/stop a synthetic phone QA stand; no production services are used."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
STATE = Path('/tmp/sc-mobile-https-stand')
CONTAINER = 'sc-mobile-https-test-20261011'
PROCESSES = []


def run(command):
    return subprocess.check_output(command, text=True).strip()


def spawn(command, env, name):
    with (STATE / (name + '.log')).open('wb') as log:
        process = subprocess.Popen(command, env=env, stdout=log, stderr=log, start_new_session=True)
        PROCESSES.append(process)
        return process.pid


def wait(url):
    for _ in range(90):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('Not ready: ' + url)


def checksum(prefix):
    weighted = sum(int(n) * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(prefix)))
    return prefix + str((-weighted) % 10)


def barcode_svg(code):
    left = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
    even = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
    parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
    right = [bits.translate(str.maketrans('01', '10')) for bits in left]
    start, half = (1, 6) if len(code) == 13 else (0, 4)
    bars = '0' * 12 + '101'
    for i, n in enumerate(code[start:start + half]):
        bars += (even if len(code) == 13 and parity[int(code[0])][i] == 'G' else left)[int(n)]
    bars += '01010' + ''.join(right[int(n)] for n in code[start + half:]) + '101' + '0' * 12
    rects = ''.join(f'<rect x="{i * 3}" y="8" width="3" height="100"/>' for i, bit in enumerate(bars) if bit == '1')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {len(bars)*3} 140" role="img" aria-label="{code}"><rect width="100%" height="100%" fill="white"/><g fill="black">{rects}</g><text x="50%" y="130" text-anchor="middle" font-size="20">{code}</text></svg>'


def checklist():
    codes = [('EAN-13: найден, остаток 10, резерв 2', '5901234123457'), ('EAN-8: найден, остаток 0', '96385074'), ('Неизвестный: привязать к QA Missing Barcode (остаток 4)', checksum('590123412346')), ('Неизвестный: создать новый товар (остаток 0)', checksum('9638510'))]
    cards = ''.join(f'<section><h2>{title}</h2>{barcode_svg(code)}<code>{code}</code></section>' for title, code in codes)
    return '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Мобильная приёмка: тест</title><style>body{font:16px system-ui;margin:auto;padding:20px;max-width:760px}section{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0;break-inside:avoid}svg{display:block;width:100%;max-width:400px}li{margin:12px 0}h2{font-size:18px}@media print{a{display:none}}</style><h1>Проверка на телефоне</h1><p><a href="/inventory">Открыть склад</a>. Только синтетические данные. Войдите тестовой учётной записью из локального файла доступа. Распечатайте коды или откройте эту страницу на другом экране.</p>''' + cards + '''<ol><li>Safari на iPhone и Chrome на Android: записать модель, версию ОС и браузера.</li><li>Склад → Сканувати: задняя камера; EAN-13 и EAN-8 находят нужную карточку.</li><li>Закрыть сканер и уйти со страницы: индикатор камеры выключается. Повторить уход во время запроса разрешения.</li><li>Запретить камеру: понятная ошибка; ручной код и поиск по названию/SKU работают. Разрешить камеру снова в настройках сайта.</li><li>Держать один код перед камерой: одно распознавание. Для увеличения количества открыть сканер ещё раз намеренно.</li><li>Неизвестный EAN-13 → поиск QA Missing Barcode → проверить карточку и новый код → привязать. Остаток остаётся 4. Повторный поиск находит товар.</li><li>Конфликт: с неизвестным кодом выбрать QA Available Pomade, у которого уже есть код. Подмена запрещена, сообщение понятно.</li><li>Неизвестный EAN-8 → поиск без результата → создание. Код заполнен, цена продажи отдельно от закупочной стоимости, остаток 0.</li><li>Мастер: создать черновик, добавить количество 3 и закупочную стоимость 120 грн. Двойное нажатие не создаёт дубль. До проведения остаток прежний; нет права проведения.</li><li>Скопировать ссылку черновика. Войти администратором или мастером с правом, открыть ссылку → Прийняти товари → подтверждение сервера. Остаток увеличился ровно на 3, резерв прежний. Повторное проведение не увеличивает его ещё раз.</li><li>Отключить Wi-Fi/мобильные данные при добавлении/проведении: нет ложного успеха. Вернуть сеть → безопасный повтор; одна строка/одно проведение. Для точной потери ответа нужны сетевые инструменты; этот случай отдельно покрыт автоматическими тестами.</li><li>Перезагрузить страницу с черновиком; проверить восстановление и читаемость без горизонтальной прокрутки.</li></ol><p>Отметить результат каждого пункта и приложить скриншот ошибки. Привязка/создание меняют тестовые данные: для нового полного прогона остановить и заново запустить стенд.</p></html>'''


def stop():
    state_file = STATE / 'state.json'
    if not state_file.exists():
        return
    state = json.loads(state_file.read_text())
    for pid in reversed(state.get('pids', [])):
        expected = state.get('commands', {}).get(str(pid))
        current = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True).stdout.strip()
        if not expected or current != expected:
            continue  # A stale PID must never stop an unrelated process.
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(2)
    subprocess.run(['docker', 'stop', state['container']], check=False, stdout=subprocess.DEVNULL)
    state_file.unlink()


def start(args):
    if (STATE / 'state.json').exists():
        raise RuntimeError('Stand already exists; stop it first')
    output = Path(args.frontend_output).resolve()
    if not (output / 'server/index.mjs').is_file():
        raise RuntimeError('Pass isolated production .output directory')
    import socket
    for port in (55440, 58002, 4043, 8089):
        with socket.socket() as probe:
            try:
                probe.bind(('127.0.0.1', port))
            except OSError as error:
                raise RuntimeError(f'Refusing occupied stand port {port}') from error
    STATE.mkdir(mode=0o700, exist_ok=True)
    os.chmod(STATE, 0o700)
    password = secrets.token_urlsafe(18)
    db_password = secrets.token_urlsafe(24)
    env = dict(os.environ, INVENTORY_STAND_DIR=str(STATE), INVENTORY_BACKEND_PATH=args.backend_path, INVENTORY_MANUAL_STAND='1', INVENTORY_TEST_LOGIN_PASSWORD=password, INVENTORY_TEST_SECRET_KEY=secrets.token_urlsafe(48), INVENTORY_TEST_DATABASE_URL=f'postgresql+asyncpg://inventory_test:{db_password}@127.0.0.1:55440/inventory_test', NUXT_PUBLIC_API_BASE='/api/v1', NITRO_HOST='127.0.0.1', NITRO_PORT='4043')
    container_id = run(['docker', 'run', '--rm', '--name', CONTAINER, '-e', 'POSTGRES_USER=inventory_test', '-e', 'POSTGRES_PASSWORD=' + db_password, '-e', 'POSTGRES_DB=inventory_test', '-p', '127.0.0.1:55440:5432', '-d', 'postgres:16-alpine'])
    pids = []
    state = {'pids': pids, 'container': container_id, 'commands': {}}
    state_file = STATE / 'state.json'
    state_file.write_text(json.dumps(state))
    try:
        for _ in range(60):
            if subprocess.run(['docker', 'exec', CONTAINER, 'pg_isready', '-U', 'inventory_test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                break
            time.sleep(0.5)
        for command, name in [([args.python, str(ROOT / 'inventory-sandbox.py')], 'backend'), ([args.node, str(output / 'server/index.mjs')], 'frontend'), ([args.python, str(ROOT / 'mobile-https-gateway.py')], 'gateway')]:
            pid = spawn(command, env, name)
            pids.append(pid)
            state['commands'][str(pid)] = run(['ps', '-p', str(pid), '-o', 'command='])
            state_file.write_text(json.dumps(state))
        if Path('/usr/bin/caffeinate').exists():
            pid = spawn(['/usr/bin/caffeinate', '-i'], env, 'awake')
            pids.append(pid)
            state['commands'][str(pid)] = run(['ps', '-p', str(pid), '-o', 'command='])
            state_file.write_text(json.dumps(state))
        wait('http://127.0.0.1:58002/__sandbox')
        wait('http://127.0.0.1:8089/inventory')
        for process in PROCESSES:
            if process.poll() is not None:
                raise RuntimeError('Stand child exited: ' + str(process.args))
        (STATE / 'checklist.html').write_text(checklist())
        for denied in ['/__sandbox', '/__sandbox/reset', '/__sandbox/inspect', '/docs', '/openapi.json', '/api/v1/backoffice/admin-users']:
            try:
                urllib.request.urlopen('http://127.0.0.1:8089' + denied)
                raise RuntimeError('Gateway leaked ' + denied)
            except urllib.error.HTTPError as error:
                assert error.code == 404
        pid = spawn([args.cloudflared, 'tunnel', '--url', 'http://127.0.0.1:8089', '--no-autoupdate'], env, 'tunnel')
        pids.append(pid)
        state['commands'][str(pid)] = run(['ps', '-p', str(pid), '-o', 'command='])
        state_file.write_text(json.dumps(state))
        import re
        url = None
        for _ in range(90):
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', (STATE / 'tunnel.log').read_text())
            if match:
                url = match.group(0)
                break
            time.sleep(0.5)
        if not url:
            raise RuntimeError('Tunnel did not return HTTPS URL')
        for process in PROCESSES:
            if process.poll() is not None:
                raise RuntimeError('Stand child exited before publish')
        for pid in pids:
            state['commands'][str(pid)] = run(['ps', '-p', str(pid), '-o', 'command='])
        state['url'] = url
        state_file.write_text(json.dumps(state))
        access = f'HTTPS: {url}/inventory\nКоды и чек-лист: {url}/mobile-checklist\n\nПароль всех тестовых пользователей: {password}\nМастер без проведения: inventory-master@example.com\nМастер с проведением: inventory-poster@example.com\nАдминистратор: inventory-browser@example.com\n\nОстановить: python3 {ROOT / "mobile-https-stand.py"} stop\nСтенд работает, пока Mac включён с открытой крышкой и имеет интернет; временный caffeinate предотвращает сон при простое, HTTPS-адрес временный.\n'
        (STATE / 'access.txt').write_text(access)
        os.chmod(STATE / 'access.txt', 0o600)
        print('Ready: ' + url + '\nAccess: ' + str(STATE / 'access.txt'))
    except BaseException:
        stop()
        raise


def retunnel(args):
    state_file = STATE / 'state.json'
    state = json.loads(state_file.read_text())
    for pid in state['pids'][:]:
        expected = state['commands'].get(str(pid), '')
        if 'cloudflared tunnel ' not in expected:
            continue
        current = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True).stdout.strip()
        if current == expected:
            os.killpg(pid, signal.SIGTERM)
        state['pids'].remove(pid)
        state['commands'].pop(str(pid), None)
    # A unique log prevents a retiring tunnel writing into the new log.
    name = 'tunnel-' + secrets.token_hex(6)
    pid = spawn([args.cloudflared, 'tunnel', '--url', 'http://127.0.0.1:8089', '--no-autoupdate'], dict(os.environ), name)
    state['pids'].append(pid)
    state['commands'][str(pid)] = run(['ps', '-p', str(pid), '-o', 'command='])
    state['tunnel_log'] = str(STATE / (name + '.log'))
    state_file.write_text(json.dumps(state))
    import re
    for _ in range(90):
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', Path(state['tunnel_log']).read_text())
        if match:
            old = state['url']
            state['url'] = match.group(0)
            state_file.write_text(json.dumps(state))
            access = STATE / 'access.txt'
            access.write_text(access.read_text().replace(old, state['url']))
            print('New temporary URL: ' + state['url'])
            return
        if PROCESSES[-1].poll() is not None:
            raise RuntimeError('Replacement tunnel exited')
        time.sleep(.5)
    raise RuntimeError('Replacement tunnel URL unavailable')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'stop', 'retunnel'])
    parser.add_argument('--frontend-output')
    parser.add_argument('--backend-path', default='/Users/markgarnicev/sc/sc-be')
    parser.add_argument('--python', default='python3')
    parser.add_argument('--node', default='node')
    parser.add_argument('--cloudflared', default='/tmp/cloudflared')
    args = parser.parse_args()
    if args.action == 'start':
        start(args)
    elif args.action == 'retunnel':
        retunnel(args)
    else:
        stop()
