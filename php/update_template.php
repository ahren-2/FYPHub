<?php
require_once 'db_config.php';

$conn = getDbConnection();

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON data'
    ]);
    exit();
}

if (!isset($data['id']) || !isset($data['title'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Template ID and title are required'
    ]);
    exit();
}

$templateId = trim((string)$data['id']);
$title = trim($data['title']);
$templateData = json_encode($data);

if ($templateId === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid template ID'
    ]);
    exit();
}

$stmt = $conn->prepare("
    UPDATE rubrics_templates
    SET
        name = ?,
        template_data = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
");

$stmt->bind_param(
    "sss",
    $title,
    $templateData,
    $templateId
);

if ($stmt->execute()) {

    echo json_encode([
        'success' => true,
        'message' => 'Template updated successfully'
    ]);

} else {

    echo json_encode([
        'success' => false,
        'message' => 'Error updating template: '
            . $conn->error
    ]);
}

$stmt->close();
$conn->close();
?>
