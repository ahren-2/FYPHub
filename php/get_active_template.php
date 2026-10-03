<?php
// Returns the rubric set active for one (programme, FYP stage) pair.
//
// The programme is what makes this lookup unambiguous: before migration 0018 the
// active rubric was keyed on the stage alone, so editing the FYP 1 rubric for one
// cohort changed what every other cohort was marked against. A template whose
// programme_id is NULL is a shared starter rubric and is used as a fallback, so a
// programme that has not chosen its own rubric yet still opens something.
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

// The programme is optional: without it the lookup falls back to the legacy
// behaviour of one active rubric per stage, which keeps any older caller working.
$programmeCode = trim((string)($_GET['programme'] ?? ''));

// The rubric tables are created by Django migrations (see db_config.php).
// Ordered so a rubric set active for this exact programme wins over a shared
// template, and a missing programme row does not turn into "no rubric at all".
$sql = "SELECT t.id, t.name, t.template_data, t.updated_at, a.fyp_stage
    FROM rubrics_active_templates a
    INNER JOIN rubrics_templates t ON t.id = a.template_id
    LEFT JOIN api_programme p ON p.id = a.programme_id
    WHERE a.fyp_stage = ?
      AND t.is_active = 1
      AND (? = '' OR p.code = ? OR p.code IS NULL)
    ORDER BY (p.code = ?) DESC
    LIMIT 1";

$stmt = $conn->prepare($sql);
$stmt->bind_param('ssss', $stage, $programmeCode, $programmeCode, $programmeCode);
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
