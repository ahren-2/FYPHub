<?php
require_once 'db_config.php';

$conn = getDbConnection();

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validate input
if (
    !$data ||
    !isset($data['id']) ||
    !isset($data['title'])
) {
    echo json_encode([
        'success' => false,
        'message' => 'Template ID and new title are required'
    ]);
    exit();
}

$templateId = trim((string)$data['id']);
$newTitle = trim($data['title']);

// Validate template ID
if ($templateId === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid template ID'
    ]);
    exit();
}

// Validate title
if (empty($newTitle)) {
    echo json_encode([
        'success' => false,
        'message' => 'Template title cannot be empty'
    ]);
    exit();
}

// Get existing template data
$stmt = $conn->prepare(
    "SELECT template_data
     FROM rubrics_templates
     WHERE id = ?"
);

$stmt->bind_param("s", $templateId);
$stmt->execute();

$result = $stmt->get_result();

// Template not found
if ($result->num_rows === 0) {

    echo json_encode([
        'success' => false,
        'message' => 'Template not found'
    ]);

    $stmt->close();
    $conn->close();
    exit();
}

$row = $result->fetch_assoc();

// Decode template JSON (may be empty or invalid)
$templateData = json_decode($row['template_data'], true);
if (!is_array($templateData)) {
    $templateData = [];
}

// Update title inside JSON
$templateData['title'] = $newTitle;

// Re-encode JSON
$updatedTemplateData = json_encode($templateData);

$stmt->close();

// Update DB
$stmt = $conn->prepare(
    "UPDATE rubrics_templates
     SET
        name = ?,
        template_data = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
     WHERE id = ?"
);

$stmt->bind_param(
    "sss",
    $newTitle,
    $updatedTemplateData,
    $templateId
);

// Execute update
if ($stmt->execute()) {

    echo json_encode([
        'success' => true,
        'message' => 'Template renamed successfully'
    ]);

} else {

    echo json_encode([
        'success' => false,
        'message' =>
            'Error renaming template: '
            . $conn->error
    ]);
}

$stmt->close();
$conn->close();
?>
