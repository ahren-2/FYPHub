<?php
require_once 'db_config.php';

$conn = getDbConnection();

// Validate ID (VARCHAR)
$templateId = isset($_GET['id'])
    ? trim((string)$_GET['id'])
    : '';

if ($templateId === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid template ID'
    ]);
    exit();
}

// Get template
$stmt = $conn->prepare(
    "SELECT
        id,
        name,
        template_data,
        updated_at
     FROM rubrics_templates
     WHERE id = ?"
);

$stmt->bind_param("s", $templateId);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows === 0) {

    echo json_encode([
        'success' => false,
        'message' => 'Template not found'
    ]);

} else {

    $row = $result->fetch_assoc();

    // Decode saved JSON
    $templateData = json_decode($row['template_data'], true);

    echo json_encode([
        'success' => true,
        'template' => [
            'id' => $row['id'],
            'title' => $row['name'],
            'data' => $templateData,
            'updated_at' => $row['updated_at']
        ]
    ]);
}

$stmt->close();
$conn->close();
?>
