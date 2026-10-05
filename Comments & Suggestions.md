Comments \& Suggestions





**GENERAL**





* Update favicon



* FAQ can be added at login page



* Current version has tips all across the pages, to help user understand parts of the page. Do remove them overtime as you see fit, but it is highly recommended to have tips in pages with higher priority, like Grading \& Rubrics



* Guide button at top right could be hidden for students, or hide parts within the Guide that are irrelevant to them, based on user role



* Email notification setup via SMTP, do create a new email to be used for admin purposes. Acts as a contact channel for all users, send email for scenarios like announcements/TRF approval. Note it somewhere in the portal for them to contact.





* Add excel file import feature, to insert student as batches to quicken student account creation (most similar existing version to this is 'Upload Information' in User Management, but its really outdated)





* Password generation for all users are input manually, we suggest to define a method for students \& lecturers to have their accounts created more efficiently and receive their credentials, ideally via email





* Excel import for timetable needs be updated to export date time and venue as well



* Updating the PHP scripts which covers the rubrics marking is feasible, but it's a port of \~10 endpoints. Perform this change only when other critical areas are updated





**STUDENT**





* More dropdowns may be used for Students' TRF submission section





* No self registration for now, add this feature if needed; if not, develop an excel file import to mass register new accounts





* Export to excel for student not working for now, it this future is wished to be kept in, do export either only the related student, or sort by classroom and export all rows for students in that matching classroom (eg. 15 June 2027, CL4, all rows) 





LECTURER (SUPERVISOR)





* Milestones page in Lecturer section would need revamps, current method only supports manual typing, dropdowns are suggest 



* Milestone has yet to be bounded to student, so marks and student



* Hide mention of proposal FYP stage, except for programmes that have proposal stage



* Quota must be set by Coordinator, but the student might be able to choose Lecturers before their quota were set, or choose them even though they are full, do check and update this



* Export to excel for lecturer is not working for now, perform updates to fix it







**COORDINATOR**







* FYP stage progression. Current project setup hasn't define a way for students to progress to the next FYP stage. Do refine further in regards to what happens to a student after final marks are decided/FYP period is completed



* The marks for FYP1 hasn't been integrated with FYP2, meaning FYP2 stage students still has missing marks from FYP1, since FYP stage progression was not set up. Milestones has this similar issue as well





**PROJECT STRUCTURE**





* There is still no clear method to separate \& group Coordinators, Lecturers, Students via programme (eg. BDM, BCS), do use one of the tables in the database to call this information





* Set up a file submission \& management, so students can upload specific files required \& lecturers (supervisors) may review them. Ideally for file viewing, it prints the file to view on screen, with option to download



* Assigning examiners to students might needs a new tab/page, currently no clear method is defined, only the auto scheduler in Coordinator will sort lecturers to be guests



* Create a custom admin portal for user management, allow it to call information and update the same database. This should allow more control and better User Management, especially across different programmes. This portal could also be used to manage, add semester entries (eg. SEP/2026). Current available admin access is logging in as admin and making user management changes



* Updates for rubrics marking need to be done onto the php scripts. The preloaded php folder in the project repo are the latest as of handover. Do updates to scripts in your C drive, laragon\\www\\php



* Updating the PHP scripts to Python, which covers the rubrics marking is feasible, but it's a port of \~10 endpoints. Please perform this change only, and only when other critical areas of the project are updated

