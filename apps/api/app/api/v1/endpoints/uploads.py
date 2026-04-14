from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import require_roles
from app.core.config import settings

router = APIRouter(dependencies=[Depends(require_roles("admin", "manager"))])


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix or ".bin"
    filename = f"{uuid4().hex}{suffix}"
    destination = settings.upload_path / filename
    destination.write_bytes(await file.read())
    return {"url": f"/uploads/{filename}", "filename": filename}
