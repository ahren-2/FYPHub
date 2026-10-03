# --- File: backend/backend/urls.py (the final, minimal root URLconf) ---

from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Route for logging in and obtaining a token
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # [CORE] Hand every other API request over to api.urls
    path('', include('api.urls')),
]