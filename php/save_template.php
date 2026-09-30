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

// Generate unique VARCHAR id (matches existing pattern: tpl_<timestamp>_<rand5>)
$rand = substr(bin2hex(random_bytes(3)), 0, 5);
$templateId = 'tpl_' . time() . '_' . $rand;

$created_by = "admin";
$version = 1;
$is_active = 1;

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

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Template saved successfully',
        'template_id' => $templateId
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
