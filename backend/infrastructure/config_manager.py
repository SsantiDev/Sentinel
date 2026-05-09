import json
import os
from django.conf import settings

class ConfigManager:
    CONFIG_FILE = os.path.join(settings.BASE_DIR, 'sentinel_config.json')
    
    DEFAULT_CONFIG = {
        "notifications": {
            "global_email": "admin@sentinel.com",
            "alert_on_failure": True,
            "consecutive_failures_threshold": 3
        },
        "system": {
            "default_check_interval": 60,
            "log_retention_days": 30,
            "maintenance_mode": False
        },
        "security": {
            "session_timeout_minutes": 480,
            "max_login_attempts": 5
        },
        "user_preferences": {}
    }

    @classmethod
    def get_user_config(cls, username):
        config = cls.get_config()
        user_prefs = config.get("user_preferences", {})
        return user_prefs.get(username, config["security"])

    @classmethod
    def get_config(cls):
        if not os.path.exists(cls.CONFIG_FILE):
            cls.save_config(cls.DEFAULT_CONFIG)
            return cls.DEFAULT_CONFIG
        
        try:
            with open(cls.CONFIG_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return cls.DEFAULT_CONFIG

    @classmethod
    def save_config(cls, config_data):
        with open(cls.CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=4)

    @classmethod
    def update_section(cls, section, data):
        current_config = cls.get_config()
        if section not in current_config:
            current_config[section] = {}

        current_config[section].update(data)
        cls.save_config(current_config)
        return True

    @classmethod
    def update_user_pref(cls, username, key, value):
        """Safely updates a single key in user_preferences[username] without overwriting others."""
        current_config = cls.get_config()
        user_prefs = current_config.setdefault('user_preferences', {})
        user_entry = user_prefs.setdefault(username, {})
        user_entry[key] = value
        cls.save_config(current_config)
        return True
