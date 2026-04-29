from unittest.mock import MagicMock, patch
import requests as req
from domain.entities.service import ServiceStatus
from infrastructure.external.http_client import ping_url


def _mock_response(status_code=200):
    r = MagicMock()
    r.status_code = status_code
    return r


def test_ping_url_up_on_200():
    with patch("infrastructure.external.http_client.requests.get", return_value=_mock_response(200)):
        result = ping_url("https://example.com")
    assert result.status == ServiceStatus.UP
    assert result.status_code == 200
    assert result.error_message is None


def test_ping_url_down_on_500():
    with patch("infrastructure.external.http_client.requests.get", return_value=_mock_response(500)):
        result = ping_url("https://example.com")
    assert result.status == ServiceStatus.DOWN
    assert result.status_code == 500


def test_ping_url_down_on_connection_error():
    with patch("infrastructure.external.http_client.requests.get", side_effect=req.ConnectionError("refused")):
        result = ping_url("https://example.com")
    assert result.status == ServiceStatus.DOWN
    assert result.status_code is None
    assert "refused" in result.error_message
