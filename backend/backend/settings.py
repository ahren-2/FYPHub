# --- File: backend/backend/settings.py (FINAL DEVELOPMENT MODE VERSION) ---

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-70y$)ul++yjd-)d)iiww3n%_+1qamqs_nu7zfg%ism_#a^o^4+'

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'api',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'django_extensions',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'fyp_hub_db',      # Laragon MySQL 8 数据库名
        'USER': 'root',            # Laragon 默认用户名
        'PASSWORD': '',            # Laragon 默认密码为空
        'HOST': '127.0.0.1',       # Laragon MySQL 8.0.30
        'PORT': '3306',
        # The whole system runs on Malaysia time (UTC+8). Pin every connection's
        # session time zone so NOW(), CURRENT_TIMESTAMP and TIMESTAMP column
        # conversion match the wall-clock convention used in this file and by the
        # PHP backend, whatever the host machine's clock is set to.
        'OPTIONS': {
            'init_command': "SET time_zone = '+08:00'",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = []

# ---------------------------------------------------------------------------
# Time zone: the whole system runs on Malaysia time (UTC+8).
#
# Every datetime column in this project stores local Malaysia wall-clock time,
# because that is what the PHP backend (php/) has always written: it uses
# NOW() / CURRENT_TIMESTAMP over a MySQL session whose time zone is +08:00.
# Django is configured to match that convention exactly.
#
# USE_TZ = False is deliberate, and it is a fix rather than a preference:
#   * With USE_TZ = True the MySQL session ran in SYSTEM (+08:00) while Django
#     assumed the database held UTC. Django therefore sent naive UTC strings
#     into a +08:00 session, so every server-generated timestamp (auto_now /
#     auto_now_add, auth_user.date_joined, admin log) was stored 8 hours behind
#     the real local time, and every value Django read back was labelled UTC
#     while actually being local time.
#   * With USE_TZ = False, timezone.now() returns Malaysia wall-clock time, so
#     auto_now / auto_now_add agree with PHP, and datetimes are stored and
#     returned without an offset. The browser then renders the same wall clock
#     whether it uses new Date(...), moment(...) or moment.utc(...).
#
# The MySQL session time zone is pinned to +08:00 in DATABASES below, so database
# side defaults (NOW(), CURRENT_TIMESTAMP) and TIMESTAMP conversion are Malaysia
# time regardless of the server's clock.
#
# One requirement remains: with USE_TZ = False the Python-side clock comes from
# the operating system, so the machine running Django must have its time zone set
# to Malaysia (UTC+8). The current deployment machine is. Do NOT "fix" this by
# setting the TZ environment variable: on Windows the C runtime cannot parse an
# IANA name such as Asia/Kuala_Lumpur and silently falls back to UTC, which makes
# Python and MySQL disagree by 8 hours.
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kuala_Lumpur'
USE_I18N = True
USE_TZ = False

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# We still need CORS settings to allow the frontend to connect
CORS_ALLOW_ALL_ORIGINS = True

# --- Email settings (remains unchanged) ---
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587        # 注释掉或删除这一行
# EMAIL_USE_TLS = True    # 注释掉或删除这一行

EMAIL_USE_SSL = True      # 【新增】改用 SSL
EMAIL_PORT = 465          # 【新增】SSL 使用 465 端口

EMAIL_HOST_USER = 'bcs23090021@student.uts.edu.my'
EMAIL_HOST_PASSWORD = 'scngausbilppanod' 
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}