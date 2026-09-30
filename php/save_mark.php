<?php
require_once 'db_config.php';

function normalize_stage($value) {
    $compact = strtoupper(preg_replace('/\s+/', '', (string)$value));
    $compact = str_replace('PROJECT', 'FYP', $compact);
    if (strpos($compact, 'PROPOSAL') !== false) return 'PROPOSAL';
    if (strpos($compact, 'FYP1') !== false || $compact === '1') return 'FYP1';
    if (strpos($compact, 'FYP2') !== false || $compact === '2') return 'FYP2';
    return '';
}

// The report/summary columns are nullable longtext holding JSON. Keep NULL as
// NULL rather than encoding it into the string "null".
function encode_json_field($value) {
    return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE);
}

$conn = getDbConnection();
$input = json_decode(file_get_contents('php://input'), true);

$templateId = trim((string)($input['template_id'] ?? ''));
$studentId = trim((string)($input['student_id'] ?? ''));
$studentName = trim((string)($input['student_name'] ?? ''));
$supervisor = trim((string)($input['supervisor'] ?? ''));
$examiner = trim((string)($input['examiner'] ?? ''));
$projectName = trim((string)($input['project_name'] ?? ''));
$course = trim((string)($input['course'] ?? ''));
$fypStageRaw = trim((string)($input['fyp_stage'] ?? ''));
$fypStage = normalize_stage($fypStageRaw);
if ($fypStage === '') $fypStage = $fypStageRaw;
$marksData = json_encode($input['marks_data'] ?? [], JSON_UNESCAPED_UNICODE);
$sectionTotals = encode_json_field($input['section_totals'] ?? null);
$coAttainment = encode_json_field($input['co_attainment'] ?? null);
$criterionMarks = encode_json_field($input['criterion_marks'] ?? null);
$totalScore = isset($input['total_score']) ? (float)$input['total_score'] : 0;
$evaluatedBy = trim((string)($input['evaluated_by'] ?? 'lecturer'));
$status = trim((string)($input['status'] ?? 'draft'));

if ($templateId === '' || $studentId === '' || $studentName === '') {
    echo json_encode(['success' => false, 'message' => 'Template, student ID, and student name are required.']);
    exit();
}

if (!in_array($status, ['draft', 'submitted', 'finalized'], true)) {
    $status = 'draft';
}

$existingStmt = $conn->prepare("SELECT id FROM rubrics_marks WHERE template_id = ? AND student_id = ? LIMIT 1");
$existingStmt->bind_param("ss", $templateId, $studentId);
$existingStmt->execute();
$existing = $existingStmt->get_result()->fetch_assoc();
$existingStmt->close();

if ($existing) {
    // updated_at is maintained by the column's ON UPDATE CURRENT_TIMESTAMP.
    $stmt = $conn->prepare("UPDATE rubrics_marks SET student_name = ?, supervisor = ?, examiner = ?, project_name = ?, course = ?, fyp_stage = ?, marks_data = ?, section_totals = ?, co_attainment = ?, criterion_marks = ?, total_score = ?, evaluated_by = ?, status = ? WHERE id = ?");
    $stmt->bind_param("ssssssssssdssi", $studentName, $supervisor, $examiner, $projectName, $course, $fypStage, $marksData, $sectionTotals, $coAttainment, $criterionMarks, $totalScore, $evaluatedBy, $status, $existing['id']);
} else {
    // evaluated_at / updated_at are filled in by their column defaults.
    $stmt = $conn->prepare("INSERT INTO rubrics_marks (template_id, student_id, student_name, supervisor, examiner, project_name, course, fyp_stage, marks_data, section_totals, co_attainment, criterion_marks, total_score, evaluated_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssssssssdss", $templateId, $studentId, $studentName, $supervisor, $examiner, $projectName, $course, $fypStage, $marksData, $sectionTotals, $coAttainment, $criterionMarks, $totalScore, $evaluatedBy, $status);
}

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'id' => $existing['id'] ?? $conn->insert_id]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save marks: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
