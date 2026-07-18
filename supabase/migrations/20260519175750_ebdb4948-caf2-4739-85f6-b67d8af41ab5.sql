DO $$
DECLARE
  pair RECORD;
  base_id uuid;
  sub_id uuid;
BEGIN
  FOR pair IN
    SELECT grade_level
    FROM classrooms
    GROUP BY grade_level
    HAVING COUNT(*) = 2
       AND COUNT(*) FILTER (WHERE name = grade_level) = 1
       AND COUNT(*) FILTER (WHERE name = grade_level || '/1') = 1
  LOOP
    SELECT id INTO base_id FROM classrooms WHERE grade_level = pair.grade_level AND name = pair.grade_level;
    SELECT id INTO sub_id  FROM classrooms WHERE grade_level = pair.grade_level AND name = pair.grade_level || '/1';

    UPDATE students             SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE enrollments          SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE home_visits          SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE homeroom_records     SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE homework_assignments SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE schedules            SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE substitute_teaching  SET classroom_id = base_id WHERE classroom_id = sub_id;
    UPDATE teacher_assignments  SET classroom_id = base_id WHERE classroom_id = sub_id;

    DELETE FROM classrooms WHERE id = sub_id;
  END LOOP;
END $$;