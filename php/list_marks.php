<?php
require_once 'db_config.php';

function decodeJsonField($value) {
    $decoded = json_decode($value ?? '', true);
    return is_array($decoded) ? $decoded : [];
}

$conn = getDbConnection();

$status = isset($_GET['status']) ? trim((string)$_GET['status']) : '';
$studentId = isset($_GET['student_id']) ? trim((string)$_GET['student_id']) : '';
$templateId = isset($_GET['template_id']) ? trim((string)$_GET['template_id']) : '';
$fypStage = isset($_GET['fyp_stage']) ? trim((string)$_GET['fyp_stage']) : '';
$programmeCode = isset($_GET['programme']) ? trim((string)$_GET['programme']) : '';

// programme_id is added by migration 0018 and is absent on an older database, in
// which case the mark rows carry no programme and the filter cannot apply.
$hasProgrammeColumn = false;
$columnCheck = $conn->query("SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rubrics_marks' AND COLUMN_NAME = 'programme_id' LIMIT 1");
if ($columnCheck && $columnCheck->num_rows > 0) {
    $hasProgrammeColumn = true;
}

$programmeSelect = $hasProgrammeColumn
    ? ', p.code AS programme_code'
    : ", NULL AS programme_code";
$programmeJoin = $hasProgrammeColumn
    ? 'LEFT JOIN api_programme p ON p.id = rm.programme_id'
    : '';

$sql = "SELECT rm.id, rm.template_id, rt.name AS template_name, rm.student_id, rm.student_name, rm.supervisor, rm.examiner, rm.project_name, rm.course, rm.fyp_stage, rm.marks_data, rm.section_totals, rm.co_attainment, rm.criterion_marks, rm.total_score, rm.evaluated_by, rm.evaluated_at, rm.updated_at, rm.status
        $programmeSelect
        FROM rubrics_marks rm
        LEFT JOIN rubrics_templates rt ON rm.template_id = rt.id
        $programmeJoin
        WHERE 1 = 1";

$params = [];
$types = '';

if ($status !== '') {
    $sql .= " AND rm.status = ?";
    $params[] = $status;
    $types .= 's';
}

if ($studentId !== '') {
    $sql .= " AND rm.student_id = ?";
    $params[] = $studentId;
    $types .= 's';
}

if ($templateId !== '') {
    $sql .= " AND rm.template_id = ?";
    $params[] = $templateId;
    $types .= 's';
}

if ($fypStage !== '') {
    $sql .= " AND REPLACE(UPPER(rm.fyp_stage), ' ', '') = REPLACE(UPPER(?), ' ', '')";
    $params[] = $fypStage;
    $types .= 's';
}

if ($programmeCode !== '' && $hasProgrammeColumn) {
    $sql .= " AND p.code = ?";
    $params[] = $programmeCode;
    $types .= 's';
}

$sql .= " ORDER BY rm.updated_at DESC, rm.evaluated_at DESC";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Failed to prepare query: ' . $conn->error]);
    exit();
}

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();
$marks = [];

while ($row = $result->fetch_assoc()) {
    $row['marks_data'] = decodeJsonField($row['marks_data'] ?? '');
    $row['section_totals'] = decodeJsonField($row['section_totals'] ?? '');
    $row['co_attainment'] = decodeJsonField($row['co_attainment'] ?? '');
    $row['criterion_marks'] = decodeJsonField($row['criterion_marks'] ?? '');
    $row['total_score'] = $row['total_score'] !== null ? (float)$row['total_score'] : null;
    $marks[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode([
    'success' => true,
    'marks' => $marks,
    'count' => count($marks)
]);
?>
