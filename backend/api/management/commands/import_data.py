# api/management/commands/import_data.py
import pandas as pd
import numpy as np
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import Profile, Course, FYPProject

class Command(BaseCommand):
    help = 'Import base data (Users, Projects, Relationships) and exclude time slots for auto-scheduling'

    def handle(self, *args, **kwargs):
        # 1. 加载并清洗学生与人员数据
        try:
            df_main = pd.read_excel('students_data.xlsx')
            df_main = df_main.replace({np.nan: None})
            self.stdout.write("Processing students_data.xlsx...")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Critical: Could not read students_data.xlsx: {e}"))
            return

        # --- 步骤 1: 注册所有 User 账号 (学生、导师、副导师) ---
        self.stdout.write("Step 1: Registering User accounts...")
        all_usernames = set()
        cols_to_check = ['username', 'supervisor_username', 'co_supervisor_username']
        for col in cols_to_check:
            if col in df_main.columns:
                valid_names = df_main[col].dropna().unique()
                all_usernames.update([str(n).strip() for n in valid_names if str(n).strip()])

        for uname in all_usernames:
            if uname.lower() == 'none' or not uname: continue
            user, created = User.objects.get_or_create(username=uname)
            if created:
                user.set_password('wow12345')
                user.save()

        # --- 步骤 2: 导入 Profile (姓名、课程、角色) ---
        self.stdout.write("Step 2: Setting up Profiles (Full Name & Roles)...")
        for _, row in df_main.iterrows():
            uname = str(row.get('username', '')).strip()
            if not uname or uname.lower() == 'none': continue

            try:
                user = User.objects.get(username=uname)
                # 处理课程
                course_code = str(row.get('course_code', 'General')).strip()
                course, _ = Course.objects.get_or_create(code=course_code, defaults={'name': course_code})
                
                Profile.objects.update_or_create(
                    user=user,
                    defaults={
                        'full_name': row.get('full_name'),
                        'role': str(row.get('role', 'student')).lower(),
                        'course': course,
                    }
                )
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Skipping profile for {uname}: {e}"))

        # --- 步骤 3: 建立项目基本信息 (学生 + 导师 + 副导师) ---
        self.stdout.write("Step 3: Linking Projects with Students and Supervisors...")
        for _, row in df_main.iterrows():
            uname = str(row.get('username', '')).strip()
            title = row.get('project_title')
            if not uname or uname.lower() == 'none' or not title: continue

            try:
                student_user = User.objects.get(username=uname)
                # 获取导师
                super_name = str(row.get('supervisor_username', '')).strip()
                super_user = User.objects.get(username=super_name) if super_name and super_name.lower() != 'none' else None
                # 获取副导师
                co_super_name = str(row.get('co_supervisor_username', '')).strip()
                co_super_user = User.objects.get(username=co_super_name) if co_super_name and co_super_name.lower() != 'none' else None

                FYPProject.objects.update_or_create(
                    title=str(title).strip(),
                    defaults={
                        'student': student_user,
                        'student_matric_id': row.get('student_matric_id'),
                        'supervisor': super_user,
                        'co_supervisor': co_super_user,
                        'fyp_stage': row.get('fyp_stage', 'FYP1'),
                    }
                )
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Failed to create project '{title}': {e}"))

        # --- 步骤 4: 从 slots_data.xlsx 仅导入考官信息 (忽略时间) ---
        try:
            df_slots = pd.read_excel('slots_data.xlsx')
            df_slots = df_slots.replace({np.nan: None})
            self.stdout.write("Step 4: Extracting Examiners from slots_data.xlsx...")
            
            for _, row in df_slots.iterrows():
                p_title = str(row.get('project_title', '')).strip()
                if not p_title or p_title.lower() == 'none': continue
                
                try:
                    project = FYPProject.objects.get(title=p_title)
                    # 仅导入考官关联
                    ex_name = str(row.get('examiner_usernames', '')).strip()
                    if ex_name and ex_name.lower() != 'none':
                        ex_user, _ = User.objects.get_or_create(username=ex_name)
                        Profile.objects.get_or_create(user=ex_user, defaults={'role': 'lecturer'})
                        project.examiner = ex_user
                        project.save()
                    # 【关键点】这里删除了 TimetableSlot.objects.create 逻辑
                except FYPProject.DoesNotExist:
                    pass 

            self.stdout.write(self.style.SUCCESS('--- BASE DATA IMPORTED SUCCESSFULLY ---'))
            self.stdout.write("Ready for coordinator to run auto-scheduler.")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error processing slots file: {e}"))