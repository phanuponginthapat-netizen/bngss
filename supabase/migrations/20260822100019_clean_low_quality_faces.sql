-- ล้างรูปห่วย quality_score <70 (เบลอ/มืด/เอียง) เพื่อความแม่นและเร็ว
DELETE FROM public.student_face_descriptors WHERE quality_score IS NOT NULL AND quality_score < 70;
DELETE FROM public.personnel_face_descriptors WHERE quality_score IS NOT NULL AND quality_score < 70;
