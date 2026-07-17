export function normalizeTranscript(value, language = "unknown") {
  let text = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase();
  if (language === "he") {
    text = text.replace(/[\u0591-\u05c7]/gu, "");
  }
  return text
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function wordErrorRate(reference, candidate, language = "unknown") {
  const expected = tokens(normalizeTranscript(reference, language));
  const actual = tokens(normalizeTranscript(candidate, language));
  if (expected.length === 0) return actual.length === 0 ? 0 : 1;
  return levenshtein(expected, actual) / expected.length;
}

export function characterErrorRate(reference, candidate, language = "unknown") {
  const expected = [
    ...normalizeTranscript(reference, language).replace(/\s+/gu, ""),
  ];
  const actual = [
    ...normalizeTranscript(candidate, language).replace(/\s+/gu, ""),
  ];
  if (expected.length === 0) return actual.length === 0 ? 0 : 1;
  return levenshtein(expected, actual) / expected.length;
}

export function timestampCoverage(segments, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const ranges = (Array.isArray(segments) ? segments : [])
    .map((segment) => ({
      start: clamp(Number(segment?.startSeconds) || 0, 0, durationSeconds),
      end: clamp(Number(segment?.endSeconds) || 0, 0, durationSeconds),
    }))
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let covered = 0;
  let start = -1;
  let end = -1;
  for (const range of ranges) {
    if (start < 0) {
      start = range.start;
      end = range.end;
      continue;
    }
    if (range.start <= end) {
      end = Math.max(end, range.end);
    } else {
      covered += end - start;
      start = range.start;
      end = range.end;
    }
  }
  if (start >= 0) covered += end - start;
  return covered / durationSeconds;
}

export function timestampViolations(segments, durationSeconds) {
  const issues = [];
  for (const [index, segment] of (Array.isArray(segments)
    ? segments
    : []
  ).entries()) {
    const start = Number(segment?.startSeconds);
    const end = Number(segment?.endSeconds);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start
    ) {
      issues.push(`segment ${index + 1} has invalid timestamps`);
      continue;
    }
    if (
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0 &&
      end > durationSeconds + 0.25
    ) {
      issues.push(`segment ${index + 1} ends after the declared duration`);
    }
  }
  return issues;
}

export function speakerLabelCoverage(segments) {
  const spoken = (Array.isArray(segments) ? segments : []).filter((segment) =>
    String(segment?.text ?? "").trim(),
  );
  if (spoken.length === 0) return 0;
  return (
    spoken.filter((segment) => String(segment?.speaker ?? "").trim()).length /
    spoken.length
  );
}

export function uncertainSegmentRatio(segments) {
  const values = Array.isArray(segments) ? segments : [];
  if (values.length === 0) return 0;
  return (
    values.filter((segment) => segment?.uncertain === true).length /
    values.length
  );
}

export function evaluateLectureCandidate({
  reference,
  segments,
  language,
  durationSeconds,
  latencyMs,
  requestSpeakerLabels,
  thresholds = {},
}) {
  const candidate = (Array.isArray(segments) ? segments : [])
    .map((segment) => String(segment?.text ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const metrics = {
    wer: wordErrorRate(reference, candidate, language),
    cer: characterErrorRate(reference, candidate, language),
    timestampCoverage: timestampCoverage(segments, durationSeconds),
    timestampViolations: timestampViolations(segments, durationSeconds),
    speakerLabelCoverage: speakerLabelCoverage(segments),
    uncertainSegmentRatio: uncertainSegmentRatio(segments),
    latencyMs: Math.max(0, Number(latencyMs) || 0),
    realtimeFactor:
      Number.isFinite(durationSeconds) && durationSeconds > 0
        ? Math.max(0, Number(latencyMs) || 0) / 1000 / durationSeconds
        : null,
    referenceCharacters: normalizeTranscript(reference, language).length,
    candidateCharacters: normalizeTranscript(candidate, language).length,
  };
  const failures = [];
  compareMaximum(failures, "WER", metrics.wer, thresholds.maxWer);
  compareMaximum(failures, "CER", metrics.cer, thresholds.maxCer);
  compareMinimum(
    failures,
    "timestamp coverage",
    metrics.timestampCoverage,
    thresholds.minTimestampCoverage,
  );
  compareMaximum(
    failures,
    "real-time factor",
    metrics.realtimeFactor,
    thresholds.maxRealtimeFactor,
  );
  compareMaximum(
    failures,
    "uncertain segment ratio",
    metrics.uncertainSegmentRatio,
    thresholds.maxUncertainSegmentRatio,
  );
  if (requestSpeakerLabels) {
    compareMinimum(
      failures,
      "speaker-label coverage",
      metrics.speakerLabelCoverage,
      thresholds.minSpeakerLabelCoverage,
    );
  }
  if (metrics.timestampViolations.length > 0) {
    failures.push(...metrics.timestampViolations);
  }
  if (metrics.candidateCharacters === 0)
    failures.push("provider returned no transcript text");
  return { candidate, metrics, failures, passed: failures.length === 0 };
}

export function estimateCost(durationSeconds, usdPerAudioMinute) {
  if (
    usdPerAudioMinute === null ||
    usdPerAudioMinute === undefined ||
    usdPerAudioMinute === ""
  )
    return null;
  const rate = Number(usdPerAudioMinute);
  if (!Number.isFinite(rate) || rate < 0) return null;
  const minutes = Math.max(0, Number(durationSeconds) || 0) / 60;
  return minutes * rate;
}

function compareMaximum(failures, label, actual, maximum) {
  const threshold = Number(maximum);
  if (!Number.isFinite(threshold) || actual === null) return;
  if (actual > threshold)
    failures.push(`${label} ${format(actual)} exceeds ${format(threshold)}`);
}

function compareMinimum(failures, label, actual, minimum) {
  const threshold = Number(minimum);
  if (!Number.isFinite(threshold)) return;
  if (actual < threshold)
    failures.push(`${label} ${format(actual)} is below ${format(threshold)}`);
}

function tokens(value) {
  return value ? value.split(" ").filter(Boolean) : [];
}

function levenshtein(left, right) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const current = new Array(right.length + 1);
  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    for (let column = 0; column <= right.length; column += 1)
      previous[column] = current[column];
  }
  return previous[right.length];
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function format(value) {
  return Number(value).toFixed(3);
}
