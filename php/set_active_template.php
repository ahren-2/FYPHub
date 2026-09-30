<?php
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

// The rubric tables are created by Django migrations (see db_config.php).
$input = file_get_contents('php://input');
$data = json_decode($input, true);

$templateId = trim((string)($data['template_id'] ?? ''));
$fypStage = normalize_stage($data['fyp_stage'] ?? '');
$updatedBy = trim((string)($data['updated_by'] ?? 'coordinator'));

if ($templateId === '' || $fypStage === '') {
    echo json_encode(['success' => false, 'message' => 'Template ID and valid FYP stage are required.']);
    exit();
}

$stmt = $conn->prepare("SELECT id, template_data FROM rubrics_templates WHERE id = ? AND is_active = 1");
$stmt->bind_param('s', $templateId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Template not found.']);
    exit();
}

$row = $result->fetch_assoc();
$templateData = json_decode($row['template_data'], true);
$templateStage = normalize_stage($templateData['fyp_stage'] ?? '');

if ($templateStage !== '' && $templateStage !== $fypStage) {
    echo json_encode([
        'success' => false,
        'message' => 'Selected stage does not match the template FYP Stage saved in Rubrics Editor.'
    ]);
    exit();
}

$stmt = $conn->prepare("INSERT INTO rubrics_active_templates (fyp_stage, template_id, updated_by)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE template_id = VALUES(template_id), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP");
$stmt->bind_param('sss', $fypStage, $templateId, $updatedBy);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Active rubric updated successfully.', 'fyp_stage' => $fypStage]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update active rubric: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>
