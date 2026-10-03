<?php
require_once 'db_config.php';

$conn = getDbConnection();

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON data'
    ]);
    exit();
}

if (!isset($data['title']) || empty(trim($data['title']))) {
    echo json_encode([
        'success' => false,
        'message' => 'Template title is required'
    ]);
    exit();
}

$title = trim($data['title']);
$templateData = json_encode($data);

// Which programme the template belongs to. Blank leaves it null, which marks it
// as a shared starter rubric any programme may adopt — that is the one place a
// null programme is meaningful, and it is what the Rubrics page offers as
// "shared".
$programmeCode = trim((string)($data['programme'] ?? ''));
$programmeId = null;

if ($programmeCode !== '') {
    $programmeStmt = $conn->prepare('SELECT id FROM api_programme WHERE code = ? LIMIT 1');
    $programmeStmt->bind_param('s', $programmeCode);
    $programmeStmt->execute();
    $programmeRow = $programmeStmt->get_result()->fetch_assoc();
    $programmeStmt->close();

    if (!$programmeRow) {
        echo json_encode([
            'success' => false,
            'message' => 'Unknown programme: ' . $programmeCode
        ]);
        exit();
    }
    $programmeId = (int)$programmeRow['id'];
}

// Generate unique VARCHAR id (matches existing pattern: tpl_<timestamp>_<rand5>)
$rand = substr(bin2hex(random_bytes(3)), 0, 5);
$templateId = 'tpl_' . time() . '_' . $rand;

$created_by = "admin";
$version = 1;
$is_active = 1;

// `programme_id` only exists from migration 0018 onwards, so the column list is
// decided from the live schema rather than assumed.
$hasProgrammeColumn = false;
$columnCheck = $conn->query("SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rubrics_templates' AND COLUMN_NAME = 'programme_id' LIMIT 1");
if ($columnCheck && $columnCheck->num_rows > 0) {
    $hasProgrammeColumn = true;
}

if ($hasProgrammeColumn) {
    $stmt = $conn->prepare("
        INSERT INTO rubrics_templates
        (id, name, template_data, created_by, version, is_active, programme_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->bind_param(
        "ssssiii",
        $templateId,
        $title,
        $templateData,
        $created_by,
        $version,
        $is_active,
        $programmeId
    );
} else {
    $stmt = $conn->prepare("
        INSERT INTO rubrics_templates
        (id, name, template_data, created_by, version, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    $stmt->bind_param(
        "ssssii",
        $templateId,
        $title,
        $templateData,
        $created_by,
        $version,
        $is_active
    );
}

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Template saved successfully',
        'template_id' => $templateId,
        'programme' => $programmeCode,
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Error saving template: ' . $conn->error
    ]);
}

$stmt->close();
$conn->close();
?>
