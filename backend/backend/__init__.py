# backend/backend/__init__.py

import pymysql
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.backends.mysql.features import DatabaseFeatures

# 1. 让 Django 识别 PyMySQL
pymysql.install_as_MySQLdb()

# 2. 绕过版本检查错误（之前的逻辑）
BaseDatabaseWrapper.check_database_version_supported = lambda self: None

# 3. 【核心修正】：禁用 MariaDB 10.4 不支持的 RETURNING 语法
# 这是解决 "RETURNING `django_migrations`.`id`" 报错的关键
DatabaseFeatures.can_return_columns_from_insert = property(lambda self: False)
DatabaseFeatures.has_returning_insert = property(lambda self: False)