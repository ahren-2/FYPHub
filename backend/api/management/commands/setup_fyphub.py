"""One-command setup for a fresh machine.

    python manage.py setup_fyphub

Creates the MySQL database named in settings.DATABASES['default'] if it does not
exist yet, then runs `migrate`, which builds the entire schema — including the
rubric tables the PHP backend reads and writes (rubrics_templates,
rubrics_marks, rubrics_active_templates) and the built-in rubric content.

Django cannot create a database itself, which is why the CREATE DATABASE step
lives here; without it a new user would still have to create the database by
hand before `migrate` could run.
"""

import pymysql
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create the configured MySQL database if missing, then run migrations.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--database',
            default='default',
            help='Database alias from settings.DATABASES to set up (default: "default").',
        )
        parser.add_argument(
            '--skip-migrate',
            action='store_true',
            help='Only create the database; do not run migrate afterwards.',
        )

    def handle(self, *args, **options):
        alias = options['database']
        if alias not in settings.DATABASES:
            raise CommandError(f'Unknown database alias: {alias}')

        config = settings.DATABASES[alias]
        if 'mysql' not in config['ENGINE']:
            raise CommandError(
                f'setup_fyphub only supports MySQL/MariaDB; {alias} uses {config["ENGINE"]}'
            )

        db_name = config['NAME']
        self.stdout.write(f'Ensuring database `{db_name}` exists on '
                          f'{config["HOST"]}:{config["PORT"]} ...')

        connection = pymysql.connect(
            host=config['HOST'] or '127.0.0.1',
            port=int(config['PORT'] or 3306),
            user=config['USER'],
            password=config['PASSWORD'],
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    f'CREATE DATABASE IF NOT EXISTS `{db_name}` '
                    'CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci'
                )
        finally:
            connection.close()

        self.stdout.write(self.style.SUCCESS(f'Database `{db_name}` ready.'))

        if options['skip_migrate']:
            return

        call_command('migrate', database=alias, interactive=False, verbosity=options['verbosity'])
        self.stdout.write(self.style.SUCCESS(
            'Schema created. The PHP backend (php/db_config.php) uses the same database.'
        ))
