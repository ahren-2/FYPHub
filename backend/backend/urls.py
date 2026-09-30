# --- File: backend/backend/urls.py (最终的、最简化的主路由) ---

from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 登录获取 token 的路由
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # 【核心】: 将所有其他 API 请求，都转交给 api.urls 文件处理
    path('', include('api.urls')),
]