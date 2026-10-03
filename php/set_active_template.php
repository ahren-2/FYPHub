<?php
// Sets the active rubric for one (programme, FYP stage) pair.
//
// The programme became part of this key in migration 0018, which moved the
// table's primary key off `fyp_stage` and onto a surrogate `id` with a unique
// constraint over (programme_id, fyp_stage). The ON DUPLICATE KEY clause below
// therefore collides on that unique key — which is the one case MySQL handles
// reliably, unlike a composite primary key.
//
// The column list is rebuilt from information_schema at runtime. A database
// created before migrations 0018/0019 may not have `programme_id` at all (it is
// added and backfilled by 0018), and a MySQL 5.7 install reports `id` as
// auto_increment where 8.0 reports it as having a default — so a hard-coded
// INSERT column list is wrong on at least one of the supported setups.
require_once 'db_config.php';
header('Content-Type: application/json');

$conn = getDbConnection();

function normalize_stage($value) {
    $compact = strtoupper(preg_replace('/\s+/', '', (string)$value));
    $compact = str_replace('PROJECT', 'FYP', $compact);
    if (strpos($compact, 'PROPOSAL') !== false) return 'PROPOSAL';
    if (strpos($compact, 'FYP1') !== false || $compact === '1') return 'FYP1';
    if (strpos($compact, 'FYP2') !== false || $compact === '2') return 'FYP2';
    return '';
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

$templateId = trim((string)($data['template_id'] ?? ''));
$fypStage = normalize_stage($data['fyp_stage'] ?? '');
$updatedBy = trim((string)($data['updated_by'] ?? 'coordinator'));
$programmeCode = trim((string)($data['programme'] ?? ''));

if ($templateId === '' || $fypStage === '') {
    echo json_encode(['success' => false, 'message' => 'Template ID and valid FYP stage are required.']);
    exit();
}

// The programme is required. MySQL treats NULLs as distinct in a UNIQUE index,
// so a null-programme row would not collide with anything: repeated writes would
// pile up duplicate stage mappings instead of updating one, and the read path
// would pick between them arbitrarily. Every programme has its own mapping since
// migration 0019, so there is no legitimate caller without one.
if ($programmeCode === '') {
    echo json_encode(['success' => false, 'message' => 'A programme is required to set an active rubric.']);
    exit();
}

$programmeStmt = $conn->prepare('SELECT id FROM api_programme WHERE code = ? LIMIT 1');
$programmeStmt->bind_param('s', $programmeCode);
$programmeStmt->execute();
$programmeRow = $programmeStmt->get_result()->fetch_assoc();
$programmeStmt->close();

if (!$programmeRow) {
    echo json_encode(['success' => false, 'message' => 'Unknown programme: ' . $programmeCode]);
    exit();
}
$programmeId = (int)$programmeRow['id'];

$stmt = $conn->prepare("SELECT id, template_data, programme_id FROM rubrics_templates WHERE id = ? AND is_active = 1");
$stmt->bind_param('s', $templateId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Template not found.']);
    exit();
}

$row = $result->fetch_assoc();
$stmt->close();

$templateData = json_decode($row['template_data'], true);
$templateStage = normalize_stage($templateData['fyp_stage'] ?? '');

if ($templateStage !== '' && $templateStage !== $fypStage) {
    echo json_encode([
        'success' => false,
        'message' => 'Selected stage does not match the template FYP Stage saved in Rubrics Editor.'
    ]);
    exit();
}

// A programme-specific template may only be activated for its own programme;
// otherwise marking one cohort could be pointed at another cohort's rubric.
$templateProgrammeId = $row['programme_id'] !== null ? (int)$row['programme_id'] : null;
if ($templateProgrammeId !== null && $programmeId !== null && $templateProgrammeId !== $programmeId) {
    echo json_encode([
        'success' => false,
        'message' => 'That template belongs to a different programme. Set it active from within its own programme.'
    ]);
    exit();
}

// Which columns exist on this database.
$columns = [];
$columnResult = $conn->query("SELECT COLUMN_NAME, EXTRA FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rubrics_active_templates'");
while ($column = $columnResult->fetch_assoc()) {
    $columns[$column['COLUMN_NAME']] = $column['EXTRA'];
}
$hasProgrammeColumn = array_key_exists('programme_id', $columns);

// `id` is auto_increment on a database created by migration 0012's original
// shape and has a default afterwards; either way it must not be listed, because
// supplying it would overwrite an existing row's identity on update.
$insertColumns = [];
$insertValues = [];
if ($hasProgrammeColumn) {
    $insertColumns[] = 'programme_id';
    $insertValues[] = $programmeId;
}
$insertColumns[] = 'fyp_stage';
$insertValues[] = $fypStage;
$insertColumns[] = 'template_id';
$insertValues[] = $templateId;
$insertColumns[] = 'updated_by';
$insertValues[] = $updatedBy;

$placeholders = implode(', ', array_fill(0, count($insertColumns), '?'));
$columnList = '`' . implode('`, `', $insertColumns) . '`';

$sql = "INSERT INTO rubrics_active_templates ($columnList) VALUES ($placeholders)
    ON DUPLICATE KEY UPDATE template_id = VALUES(template_id), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Failed to prepare statement: ' . $conn->error]);
    exit();
}

$types = str_repeat('s', count($insertValues));
$stmt->bind_param($types, ...$insertValues);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Active rubric updated successfully.',
        'fyp_stage' => $fypStage,
        'programme' => $programmeCode,
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update active rubric: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>
