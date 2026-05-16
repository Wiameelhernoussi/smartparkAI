# pyrefly: ignore [missing-import]
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_read_root():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert "Smart Parking IA" in response.json()["status"]

@pytest.mark.asyncio
async def test_get_parkings():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/parkings")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
