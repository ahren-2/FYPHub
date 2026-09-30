<?php
require_once 'db_config.php';

$conn = getDbConnection();

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['id'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Template ID is required'
    ]);
    exit();
}

$templateId = trim((string)$data['id']);

if ($templateId === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid template ID'
    ]);
    exit();
}

// Hard delete template (cascades to rubrics_marks & rubrics_version_history via FK)
$stmt = $conn->prepare("DELETE FROM rubrics_templates WHERE id = ?");
$stmt->bind_param("s", $templateId);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Template deleted successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Template not found'
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Error deleting template: ' . $conn->error
    ]);
}

$stmt->close();
$conn->close();
?>
