from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import timedelta
from corsheaders.defaults import default_headers



load_dotenv() # <--- loads the .env file


# FIX FOR XAMPP / MARIADB 10.4 COMPATIBILITY
try:
    # 1. Bypass the version check
    from django.db.backends.mysql.base import DatabaseWrapper
    DatabaseWrapper.check_database_version_supported = lambda self: None
    
    # 2. Disable the 'RETURNING' SQL feature (Fixes the 1064 error)
    from django.db.backends.mysql.features import DatabaseFeatures
    DatabaseFeatures.can_return_columns_from_insert = False
except ImportError:
    pass
# --------------------------------------------------------------------------

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-uox_ilsn8=uv^gn^qra6-3sqe@+r9fh_0n2tc_df5y^l_m#q88'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = []


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',       # For the API
    'corsheaders',          # For Frontend communication
    'core',
    'attendance', #------------------attendance-----------------
    'faculty_assignments',
    'student_portal',
    'counselling',
    'results',

    # --- 3rd Party Auth Apps ---
    'rest_framework.authtoken',
    'dj_rest_auth',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'dj_rest_auth.registration',
    'allauth.socialaccount.providers.google', # Google Provider
]
SITE_ID = 1  # Required by allauth

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',        #Added for CORS
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    
]

ROOT_URLCONF = 'config.urls'

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

WSGI_APPLICATION = 'config.wsgi.application'


AUTHENTICATION_BACKENDS = [
    # Needed to login by username in Django admin, etc.
    'django.contrib.auth.backends.ModelBackend',

    # `allauth` specific authentication methods, such as login by e-mail
    'allauth.account.auth_backends.AuthenticationBackend',
]

# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'edusphere_db',      
        'USER': 'root',              
        'PASSWORD': '',             
        'HOST': 'localhost',         
        'PORT': '3306',              
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Kolkata'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'

# --- CORS CONFIGURATION ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-department-id', 
]

# Allow our custom context headers through CORS
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-academic-year-id',
    'x-department-id',
    'x-term',
]

# --- AUTHENTICATION CONFIG ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

# JWT Settings
SIMPLE_JWT = {
    # Increase Access Token to 60 minutes (or even 1 day for development)
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    
    # Refresh Token lasts 1 day
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    
    # Rotating tokens ensures security, but can be tricky if frontend calls it twice. 
    # Let's keep it simple for now:
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}



# Point to your new custom adapter
ACCOUNT_ADAPTER = 'core.adapters.CustomAccountAdapter'

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': None,
    'JWT_AUTH_REFRESH_COOKIE': None,
    'USER_DETAILS_SERIALIZER': 'core.serializers.CustomUserDetailsSerializer',
    'REGISTER_SERIALIZER': 'core.serializers.CustomRegisterSerializer',
# Sending the email
    'PASSWORD_RESET_SERIALIZER': 'core.serializers.CustomPasswordResetSerializer',
# Confirming the new password (The name we just changed)
    'PASSWORD_RESET_CONFIRM_SERIALIZER': 'core.serializers.CustomPasswordResetConfirmSerializer',
}

# --- ALLAUTH CONFIG ---
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email'] # This handles the email required requirement
ACCOUNT_EMAIL_VERIFICATION = 'none' 

# --- GOOGLE CONFIG  ---

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'key': ''
        },
        'SCOPE': [
            'profile',
            'email',
        ],
        'AUTH_PARAMS': {
            'access_type': 'online',
        }
    }
}



# 1. Use Email as the primary identifier (Not Username)
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_UNIQUE_EMAIL = True

# 2. AUTO-LINK Google Logins to Invited Users
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True 
SOCIALACCOUNT_QUERY_EMAIL = True

# --- EMAIL CONFIGURATION ---

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

# CREDENTIALS
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER') #Gmail address 
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD') #App Password

import os

# --- MEDIA FILES (User Uploads like Profile Pics) ---
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')