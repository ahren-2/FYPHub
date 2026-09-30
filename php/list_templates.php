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

// rubrics_active_templates is created by Django migrations (see db_config.php);
// all three rubric tables are assumed to exist here.
$sql = "SELECT
            t.id,
            t.name,
            t.template_data,
            t.updated_at,
            t.version,
            t.is_active,
            a.fyp_stage AS active_for_stage
        FROM rubrics_templates t
        LEFT JOIN rubrics_active_templates a ON a.template_id = t.id
        WHERE t.is_active = 1
        ORDER BY t.updated_at DESC";

$result = $conn->query($sql);
$templates = [];

if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        if (trim((string)$row['id']) === '') continue;

        $templateData = json_decode($row['template_data'], true);
        if (!is_array($templateData)) $templateData = [];

        $stage = $templateData['fyp_stage'] ?? '';
        $course = $templateData['course'] ?? '';

        $templates[] = [
            'id' => $row['id'],
            'title' => $row['name'],
            'course' => $course,
            'fyp_stage' => normalize_stage($stage),
            'fyp_stage_raw' => $stage,
            'updated_at' => $row['updated_at'],
            'version' => (int)$row['version'],
            'active_for_stage' => normalize_stage($row['active_for_stage'] ?? '')
        ];
    }
}

echo json_encode(['success' => true, 'templates' => $templates]);
$conn->close();
?>
