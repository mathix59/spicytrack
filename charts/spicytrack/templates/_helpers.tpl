{{- define "spicytrack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spicytrack.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name (include "spicytrack.name" .) | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "spicytrack.labels" -}}
app.kubernetes.io/name: {{ include "spicytrack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end }}

{{- define "spicytrack.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spicytrack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "spicytrack.componentName" -}}
{{- printf "%s-%s" (include "spicytrack.fullname" .root) .component | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spicytrack.postgresqlName" -}}
{{- printf "%s-postgresql" (include "spicytrack.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spicytrack.postgresqlSecretName" -}}
{{- default (printf "%s-credentials" (include "spicytrack.postgresqlName" .)) .Values.postgresql.auth.existingSecret }}
{{- end }}

{{- define "spicytrack.objectStorageName" -}}
{{- printf "%s-rustfs" (include "spicytrack.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "spicytrack.objectStorageSecretName" -}}
{{- default (printf "%s-credentials" (include "spicytrack.objectStorageName" .)) .Values.objectStorage.auth.existingSecret }}
{{- end }}

{{- define "spicytrack.optionalDigestImage" -}}
{{- if .digest -}}
{{- printf "%s@%s" .repository .digest -}}
{{- else -}}
{{- printf "%s:%s" .repository (required "image.tag is required when image.digest is empty" .tag) -}}
{{- end -}}
{{- end }}
