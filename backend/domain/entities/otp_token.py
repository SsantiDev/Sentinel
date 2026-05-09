from dataclasses import dataclass
from typing import Literal

OTPPurpose = Literal['register', 'reset']

@dataclass(frozen=True)
class OTPToken:
    email: str
    code: str
    purpose: OTPPurpose
