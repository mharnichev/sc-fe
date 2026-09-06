"""Disposable real-backend smoke harness; never uses the normal app DB/lifespan.

Run with SEGMENTS_BACKEND_PATH pointing at sc-be and
SEGMENTS_TEST_DATABASE_URL pointing at a localhost database named *test*.
The app listens only on 127.0.0.1:58001. All providers record in memory.
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.engine import make_url

url = os.environ["SEGMENTS_TEST_DATABASE_URL"]
parsed = make_url(url)
if parsed.host not in {"localhost", "127.0.0.1", "::1"} or "test" not in (parsed.database or ""):
    raise RuntimeError("Refusing non-local/non-test database")
sys.path.insert(0, os.environ["SEGMENTS_BACKEND_PATH"])
# Override even a developer .env before any backend import.
os.environ.update(DATABASE_URL=url, APP_ENV="test", SECRET_KEY="disposable-segments-smoke-only",
                  SMS_PROVIDER="stub", SMS_CLUB_TOKEN="", TELEGRAM_BOT_TOKEN="",
                  CAMPAIGN_RUN_SCHEDULER_ENABLED="false", SMS_QUEUE_WORKER_ENABLED="false")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.main import app as production_app
from app.core.database import Base, get_db_session
from app.core.security import create_access_token
from app.models.admin_user import AdminUser
from app.models.booking import BarberService, Booking, BookingStatus, Master
from app.models.customer import Customer
from app.models.messaging import Campaign, CampaignType, ClientCommunicationPreference, ConsentStatus, MessageChannel, MessagePurpose, MessageTemplate, MessageRecipient, MessageDeliveryStatus
from app.models.promotion import Promotion
from app.schemas.auth import AdminUserResponse
from app.services.messaging import MessageProvider, MessagingService, ProviderSendResult
from app.services.campaign_runs import CampaignRunService
from app.api.v1.routes import messaging, campaign_runs

schema = "segments_browser_test_" + uuid4().hex
admin_engine = create_async_engine(url)
engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
database = async_sessionmaker(engine, expire_on_commit=False)
bootstrap = {}
sent = []


class SandboxProvider(MessageProvider):
    def __init__(self, channel):
        self.channel = channel

    async def send_message(self, *, destination, body, reply_markup=None):
        sent.append({"channel": self.channel.value, "destination": destination, "body": body})
        return ProviderSendResult(provider_message_id=f"sandbox-{len(sent)}", raw_response={"sandbox": True})


service = MessagingService(providers={channel: SandboxProvider(channel) for channel in (MessageChannel.sms, MessageChannel.telegram)})
run_service = CampaignRunService(service)
messaging.service = service
campaign_runs.messaging_service = service
campaign_runs.campaign_run_service = run_service


async def isolated_session():
    async with database() as session:
        yield session


async def process_sandbox():
    async with database() as session:
        await run_service.process_run_messages(session)


messaging._process_pending_messages_background = process_sandbox


async def seed_baseline():
    async with database() as session:
        admin = AdminUser(email="segments-browser@example.com", hashed_password="unused", is_superuser=True)
        master = Master(full_name="Sandbox master")
        session.add_all([admin, master])
        await session.flush()
        haircut = BarberService(master_id=master.id, name="Sandbox haircut", duration_minutes=30, price=100)
        session.add(haircut)
        await session.flush()
        now = datetime.now(timezone.utc)
        for index, name in enumerate(["Sandbox completed", "Sandbox imported", "Sandbox opted out", "Sandbox upcoming", "Sandbox unknown"], 1):
            customer = Customer(phone=f"+38050000{index:04}", name=name,
                                imported_last_visit_at=now-timedelta(days=180) if index == 2 else None)
            session.add(customer)
            await session.flush()
            if index in {1, 3, 4}:
                end = now-timedelta(days=180)
                session.add(Booking(customer_id=customer.id, customer_name=name, customer_phone=customer.phone,
                                    master_id=master.id, service_id=haircut.id, start_at=end-timedelta(minutes=30),
                                    end_at=end, status=BookingStatus.completed))
            if index == 4:
                session.add(Booking(customer_id=customer.id, customer_name=name, customer_phone=customer.phone,
                                    master_id=master.id, service_id=haircut.id, start_at=now+timedelta(days=1),
                                    end_at=now+timedelta(days=1, minutes=30), status=BookingStatus.confirmed))
            session.add(ClientCommunicationPreference(customer_id=customer.id,
                        telegram_chat_id="sandbox-chat" if index == 1 else None,
                        marketing_consent=ConsentStatus.opted_out if index == 3 else ConsentStatus.opted_in))
        notification = Campaign(name="Sandbox booking notification", type=CampaignType.booking_confirmation,
                            purpose=MessagePurpose.transactional, channel=MessageChannel.telegram,
                            metadata_json={"message_body": "Sandbox booking {{client_name}}"})
        legacy = Campaign(name="Sandbox legacy campaign", type=CampaignType.manual, channel=MessageChannel.telegram)
        template = MessageTemplate(name="Sandbox reusable template", channel=MessageChannel.telegram,
                                   body="Sandbox {{client_name}} — {{discount_code}}", language="uk")
        promotion = Promotion(code="SANDBOX10", name_uk="Тестова пропозиція", name_en="Sandbox offer", discount_percent=10)
        session.add_all([notification, legacy, template, promotion])
        await session.commit()
        bootstrap.update(sandbox=True, schema=schema, access_token=create_access_token(str(admin.id)),
                         user=AdminUserResponse.model_validate(admin).model_dump(mode="json"),
                         seed={"customers": {"completed": 1, "imported": 2, "opted_out": 3, "upcoming": 4, "unknown": 5},
                               "master_id": master.id, "service_id": haircut.id, "notification_id": notification.id,
                               "legacy_campaign_id": legacy.id, "template_id": template.id,
                               "promotion_id": promotion.id, "promotion_code": promotion.code})


@asynccontextmanager
async def lifespan(_):
    async with admin_engine.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await seed_baseline()
    try:
        yield
    finally:
        await engine.dispose()
        async with admin_engine.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin_engine.dispose()


app = FastAPI(lifespan=lifespan)
# Copy route objects only: include_router would merge the production lifespan
# and accidentally start unrelated schedulers.
app.router.routes.extend(production_app.router.routes)
app.dependency_overrides[get_db_session] = isolated_session
production_app.dependency_overrides[get_db_session] = isolated_session
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:4041"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/__sandbox")
async def sandbox_status():
    return {**bootstrap, "recorded_messages": sent}


@app.post("/__sandbox/process")
async def sandbox_process():
    await process_sandbox()
    return {"recorded_messages": sent}


@app.post("/__sandbox/reset")
async def sandbox_reset():
    # Test runner must use --workers=1. Only our random, disposable schema exists
    # on this engine's search path; never use production configuration here.
    tables = ", ".join(f'"{schema}"."{table.name}"' for table in Base.metadata.tables.values())
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    sent.clear()
    bootstrap.pop("rules_fixture", None)
    await seed_baseline()
    return {**bootstrap, "recorded_messages": sent}


@app.post("/__sandbox/rules-fixtures")
async def rules_fixtures():
    if "rules_fixture" in bootstrap:
        return bootstrap["rules_fixture"]
    at = datetime.fromisoformat("2026-09-06T12:00:00+03:00")
    async with database() as session:
        master = Master(full_name="Rules master")
        other_master = Master(full_name="Rules other master")
        session.add_all([master, other_master])
        await session.flush()
        haircut = BarberService(master_id=master.id, name="Rules historical service", duration_minutes=30, price=100, is_active=False)
        other_service = BarberService(master_id=other_master.id, name="Rules other service", duration_minutes=30, price=100)
        campaign = Campaign(name="Rules historical marketing", type=CampaignType.manual, channel=MessageChannel.telegram,
                            purpose=MessagePurpose.marketing, metadata_json={"message_body": "Historical sandbox"})
        session.add_all([haircut, other_service, campaign])
        await session.flush()
        customers = {}
        async def customer(key, dates=(), other_first=False, **kwargs):
            item = Customer(name=f"Rules {key}", phone=f"+38050999{len(customers):04}", **kwargs)
            session.add(item)
            await session.flush()
            customers[key] = item.id
            for index, date in enumerate(dates):
                end = datetime.fromisoformat(date)
                session.add(Booking(customer_id=item.id, customer_name=item.name, customer_phone=item.phone,
                                    master_id=other_master.id if other_first and index == 0 else master.id,
                                    service_id=other_service.id if other_first and index == 0 else haircut.id,
                                    start_at=end-timedelta(minutes=30),
                                    end_at=end, status=BookingStatus.completed))
            return item
        for key, date in {
            "boundary_min_exact": "2026-06-06T12:00:00+03:00", "boundary_min_older": "2026-06-05T12:00:00+03:00",
            "boundary_max_exact": "2025-09-06T12:00:00+03:00", "boundary_max_older": "2025-09-05T12:00:00+03:00",
            "days90": "2026-06-08T12:00:00+03:00", "first_recent": "2026-08-01T12:00:00+03:00",
        }.items():
            await customer(key, [date])
        rich = await customer("rich", ["2026-05-01T12:00:00+03:00", "2026-08-01T12:00:00+03:00", "2026-08-20T12:00:00+03:00"], other_first=True)
        await customer("imported_only", imported_last_visit_at=datetime.fromisoformat("2026-06-01T12:00:00+03:00"))
        await customer("unknown")
        await customer("explicit_new", imported_is_new_client=True)
        failed = await customer("failed_only", ["2026-08-01T12:00:00+03:00"])
        upcoming = await customer("upcoming", ["2026-08-01T12:00:00+03:00"])
        session.add(Booking(customer_id=upcoming.id, customer_name=upcoming.name, customer_phone=upcoming.phone,
                            master_id=master.id, service_id=haircut.id, start_at=at+timedelta(days=1),
                            end_at=at+timedelta(days=1, minutes=30), status=BookingStatus.confirmed))
        for index in range(25):
            await customer(f"page_{index}", ["2026-08-01T12:00:00+03:00"])
        session.add(MessageRecipient(campaign_id=campaign.id, customer_id=rich.id, channel=MessageChannel.telegram,
                    idempotency_key="sandbox-rules-accepted",
                    status=MessageDeliveryStatus.sent, sent_at=datetime.fromisoformat("2026-08-25T12:00:00+03:00"),
                    rendered_message="Historical sandbox", provider_message_id="sandbox-history"))
        session.add(MessageRecipient(campaign_id=campaign.id, customer_id=failed.id, channel=MessageChannel.telegram,
                    idempotency_key="sandbox-rules-failed",
                    status=MessageDeliveryStatus.failed, last_error="sandbox failed before acceptance", rendered_message="Historical sandbox"))
        await session.commit()
        result = {"evaluated_at": at.isoformat(), "master_id": master.id, "service_id": haircut.id,
                  "other_master_id": other_master.id, "other_service_id": other_service.id,
                  "campaign_id": campaign.id, "customers": customers}
        bootstrap["rules_fixture"] = result
        return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=58001)
