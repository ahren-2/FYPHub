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

// Get template, with the programme it belongs to. The editor needs that to
// refuse a rubric kept by another programme — the URL can say anything, so the
// authoritative answer has to come from here.
//
// `programme_id` only exists from migration 0018 onwards, so the query is built
// from the live schema rather than assumed.
$hasProgrammeColumn = false;
$columnCheck = $conn->query("SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rubrics_templates' AND COLUMN_NAME = 'programme_id' LIMIT 1");
if ($columnCheck && $columnCheck->num_rows > 0) {
    $hasProgrammeColumn = true;
}

$sql = $hasProgrammeColumn
    ? "SELECT
        t.id,
        t.name,
        t.template_data,
        t.updated_at,
        p.code AS programme_code
     FROM rubrics_templates t
     LEFT JOIN api_programme p ON p.id = t.programme_id
     WHERE t.id = ?"
    : "SELECT
        id,
        name,
        template_data,
        updated_at,
        NULL AS programme_code
     FROM rubrics_templates
     WHERE id = ?";

$stmt = $conn->prepare($sql);

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
            // NULL means a shared template: no programme owns it, so any
            // programme may edit and adopt it.
            'programme_code' => $row['programme_code'],
            'updated_at' => $row['updated_at']
        ]
    ]);
}

$stmt->close();
$conn->close();
?>
