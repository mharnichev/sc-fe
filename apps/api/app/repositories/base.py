from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session


class SQLAlchemyRepository:
    def __init__(self, model: type):
        self.model = model

    def list(self, db: Session, offset: int = 0, limit: int = 20, filters: dict[str, Any] | None = None) -> tuple[Sequence[Any], int]:
        statement = select(self.model)
        count_statement = select(func.count()).select_from(self.model)
        filters = filters or {}
        for key, value in filters.items():
            if value is None or value == "":
                continue
            statement = statement.where(getattr(self.model, key) == value)
            count_statement = count_statement.where(getattr(self.model, key) == value)
        items = db.scalars(statement.offset(offset).limit(limit)).all()
        total = db.scalar(count_statement) or 0
        return items, total

    def get(self, db: Session, entity_id: int):
        return db.get(self.model, entity_id)

    def create(self, db: Session, payload: dict[str, Any]):
        entity = self.model(**payload)
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity

    def update(self, db: Session, entity_id: int, payload: dict[str, Any]):
        entity = self.get(db, entity_id)
        if not entity:
            return None
        for key, value in payload.items():
            setattr(entity, key, value)
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return entity

    def delete(self, db: Session, entity_id: int) -> bool:
        entity = self.get(db, entity_id)
        if not entity:
            return False
        db.delete(entity)
        db.commit()
        return True
