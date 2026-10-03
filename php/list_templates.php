<?php
// Lists the marking templates, with the programme each belongs to.
//
// `?programme=BCS` narrows the list to that programme plus the shared starter
// templates (programme_id IS NULL). With no parameter every template is
// returned, each carrying its own programme, so the Rubrics page can group them.
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

$programmeCode = trim((string)($_GET['programme'] ?? ''));

// rubrics_active_templates is created by Django migrations (see db_config.php);
// all three rubric tables are assumed to exist here. The active mapping is now
// per (programme, stage), so the join is narrowed to this programme's own rows —
// a LEFT JOIN on template_id alone would attribute one programme's active stage
// to another programme's copy of the same template.
$sql = "SELECT
            t.id,
            t.name,
            t.template_data,
            t.updated_at,
            t.version,
            t.is_active,
            p.code AS programme_code,
            a.fyp_stage AS active_for_stage
        FROM rubrics_templates t
        LEFT JOIN api_programme p ON p.id = t.programme_id
        LEFT JOIN rubrics_active_templates a
               ON a.template_id = t.id
              AND (a.programme_id = t.programme_id OR (a.programme_id IS NULL AND t.programme_id IS NULL))
        WHERE t.is_active = 1
          AND (? = '' OR p.code = ? OR p.code IS NULL)
        ORDER BY t.updated_at DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param('ss', $programmeCode, $programmeCode);
$stmt->execute();
$result = $stmt->get_result();
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
            'programme_code' => $row['programme_code'],
            'updated_at' => $row['updated_at'],
            'version' => (int)$row['version'],
            'active_for_stage' => normalize_stage($row['active_for_stage'] ?? '')
        ];
    }
}

$stmt->close();
echo json_encode(['success' => true, 'templates' => $templates]);
$conn->close();
?>
