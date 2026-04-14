from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import DBSession, get_current_user
from app.models.entities import User
from app.schemas.auth import LoginPayload, RefreshPayload, TokenPair, UserMe
from app.services.auth import authenticate, refresh_access_token

router = APIRouter()


@router.post("/login", response_model=TokenPair)
def login(payload: LoginPayload, db: DBSession) -> TokenPair:
    access_token, refresh_token, _ = authenticate(db, payload.email, payload.password)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshPayload, db: DBSession) -> TokenPair:
    access_token, refresh_token = refresh_access_token(db, payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserMe)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserMe:
    return current_user
