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

$stage = normalize_stage($_GET['fyp_stage'] ?? '');
if ($stage === '') {
    echo json_encode(['success' => false, 'message' => 'Valid FYP stage is required.']);
    exit();
}

// The rubric tables are created by Django migrations (see db_config.php).
$stmt = $conn->prepare("SELECT t.id, t.name, t.template_data, t.updated_at, a.fyp_stage
    FROM rubrics_active_templates a
    INNER JOIN rubrics_templates t ON t.id = a.template_id
    WHERE a.fyp_stage = ? AND t.is_active = 1
    LIMIT 1");
$stmt->bind_param('s', $stage);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => true, 'template' => null]);
    exit();
}

$row = $result->fetch_assoc();
$templateData = json_decode($row['template_data'], true);
if (!is_array($templateData)) $templateData = [];

echo json_encode([
    'success' => true,
    'template' => [
        'id' => $row['id'],
        'title' => $row['name'],
        'fyp_stage' => normalize_stage($row['fyp_stage']),
        'data' => $templateData,
        'updated_at' => $row['updated_at']
    ]
]);

$stmt->close();
$conn->close();
?>
