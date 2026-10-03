# backend/backend/__init__.py

import pymysql
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.backends.mysql.features import DatabaseFeatures

# 1. Make Django recognise PyMySQL
pymysql.install_as_MySQLdb()

# 2. Bypass the version check error (the previous logic)
BaseDatabaseWrapper.check_database_version_supported = lambda self: None

# 3. [CORE FIX] Disable the RETURNING syntax that MariaDB 10.4 does not support
# This is the key to fixing the "RETURNING `django_migrations`.`id`" error
DatabaseFeatures.can_return_columns_from_insert = property(lambda self: False)
DatabaseFeatures.has_returning_insert = property(lambda self: False)