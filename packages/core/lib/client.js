window.__ModuleLoader__.load({
  id: 'dsh-claybot',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    'use strict'

    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useCallback = React.useCallback
    var clientCtx = null

    var API = '/api/claybot/db'
    var CONFIG_API = '/api/claybot'
    var EMBEDDING_API = '/api/claybot/embedding'
    var MEMORY_API = '/api/claybot/memory'
    var MAX_ROWS = 500

    var CSS = [
      '.cb-root{height:100%;min-height:0;overflow:auto;box-sizing:border-box;padding:14px 14px 30px;color:var(--dsw-alias-label-primary,#e8e8e8);font-family:inherit;font-size:13px;line-height:1.5;background:transparent}',
      '.cb-root *{box-sizing:border-box}',
      '.cb-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}',
      '.cb-title{font-size:18px;font-weight:650;letter-spacing:-.01em;margin:0}',
      '.cb-subtitle{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:12px;margin-top:2px}',
      '.cb-seg{display:flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-radius:10px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none}',
      '.cb-seg::-webkit-scrollbar{display:none}',
      '.cb-seg-btn{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9a9a9a);padding:5px 9px;border-radius:8px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
      '.cb-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#e8e8e8)}',
      '.cb-seg-btn.is-active{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#e8e8e8);font-weight:600;box-shadow:var(--dsw-shadow-lv1,none)}',
      '.cb-seg-mini{display:inline-flex;padding:1px;margin-bottom:10px}',
      '.cb-seg-mini .cb-seg-btn{padding:3px 8px;font-size:11px}',
      '.cb-tabs{display:flex;gap:14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));margin:4px 0 12px;overflow-x:auto;scrollbar-width:none}',
      '.cb-tabs::-webkit-scrollbar{display:none}',
      '.cb-tab{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#9a9a9a);padding:7px 0;font:inherit;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}',
      '.cb-tab.is-active{color:var(--dsw-alias-label-primary,#e8e8e8);border-bottom-color:var(--dsw-alias-brand-primary,#3b82f6);font-weight:600}',
      '.cb-card{background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:12px;padding:12px;margin-bottom:10px;box-shadow:var(--dsw-shadow-lv1,none)}',
      '.cb-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}',
      '.cb-card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;min-width:0}',
      '.cb-card-sub{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:11px;font-weight:400;white-space:nowrap}',
      '.cb-card-sub.wrap{white-space:normal;overflow-wrap:anywhere}',
      '.cb-hero-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.cb-hero-state{font-size:16px;font-weight:650;letter-spacing:-.01em}',
      '.cb-hero-desc{color:var(--dsw-alias-label-secondary,#9a9a9a);font-size:12px;margin:4px 0 10px;overflow-wrap:anywhere}',
      '.cb-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;background:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-dot.ok{background:var(--dsw-alias-state-success-primary,#34d399);box-shadow:0 0 0 3px rgba(52,211,153,.16)}',
      '.cb-dot.warn{background:var(--dsw-alias-state-warn-primary,#fbbf24);box-shadow:0 0 0 3px rgba(251,191,36,.14)}',
      '.cb-dot.err{background:var(--dsw-alias-state-error-primary,#f87171);box-shadow:0 0 0 3px rgba(248,113,113,.14)}',
      '.cb-dot.idle{background:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}',
      '.cb-metric{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-radius:10px;padding:7px 9px;min-width:0}',
      '.cb-metric-label{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-metric-value{font-size:13px;font-weight:600;margin-top:1px;overflow-wrap:anywhere}',
      '.cb-metric-hint{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b8b8b);margin-top:1px;overflow-wrap:anywhere}',
      '.cb-bars{display:flex;align-items:flex-end;gap:2px;height:54px;padding-top:4px;margin-top:8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16))}',
      '.cb-bar{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end}',
      '.cb-bar-fill{width:100%;min-height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-state-success-primary,#34d399)}',
      '.cb-bar-fill.is-fail{background:var(--dsw-alias-state-error-primary,#f87171)}',
      '.cb-bar-labels{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:var(--dsw-alias-label-tertiary,#8b8b8b);margin-top:3px}',
      '.cb-resource-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}',
      '.cb-resource{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-radius:10px;padding:8px 9px;min-width:0;min-height:166px;display:flex;flex-direction:column}',
      '.cb-resource-label{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-resource-value{font-size:16px;font-weight:650;letter-spacing:-.01em;margin-top:1px}',
      '.cb-resource-sub{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b8b8b);margin-top:1px;overflow-wrap:anywhere}',
      '.cb-resource-ring{align-items:center;justify-content:center;text-align:center}',
      '.cb-resource-ring .cb-resource-label{align-self:flex-start;width:100%;text-align:left}',
      '.cb-spark-wrap{display:flex;gap:5px;align-items:stretch;flex:1;min-height:92px;margin-top:6px}',
      '.cb-spark-scale{display:flex;flex-direction:column;justify-content:space-between;height:auto;min-height:92px;font-size:8px;color:var(--dsw-alias-label-tertiary,#8b8b8b);text-align:right;min-width:22px;line-height:1}',
      '.cb-spark-plot{position:relative;flex:1;height:auto;min-height:92px;border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));background-image:linear-gradient(to top,rgba(127,127,127,.16) 1px,transparent 1px),linear-gradient(to right,rgba(127,127,127,.12) 1px,transparent 1px);background-size:100% 25%,25% 100%}',
      '.cb-spark-plot::after{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed rgba(127,127,127,.35);pointer-events:none}',
      '.cb-spark{width:100%;height:100%;min-height:92px;display:block}',
      '.cb-spark polyline{fill:none;stroke:var(--dsw-alias-state-success-primary,#34d399);stroke-width:1.5;vector-effect:non-scaling-stroke}',
      '.cb-spark.cpu polyline{stroke:#60a5fa}',
      '.cb-spark.gpu polyline{stroke:#c084fc}',
      '.cb-spark.ram polyline{stroke:#fbbf24}',
      '.cb-spark-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-ring-wrap{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px;flex:1;width:100%}',
      '.cb-ring{width:64px;height:64px;flex:none}',
      '.cb-ring-bg{fill:none;stroke:var(--dsw-alias-border-l1,rgba(127,127,127,.22));stroke-width:5}',
      '.cb-ring-fg{fill:none;stroke:#c084fc;stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .3s}',
      '.cb-ring-text{fill:var(--dsw-alias-label-primary,#e8e8e8);font-size:9px;font-weight:600}',
      '.cb-ring-copy{min-width:0;text-align:left}',
      '.cb-ring-row{display:grid;grid-template-columns:auto auto;gap:2px 8px;font-size:10px;align-items:baseline}',
      '.cb-ring-key{color:var(--dsw-alias-label-tertiary,#8b8b8b);text-align:left}',
      '.cb-ring-val{color:var(--dsw-alias-label-primary,#e8e8e8);text-align:right;font-variant-numeric:tabular-nums}',
      '.cb-modal-backdrop{position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px}',
      '.cb-modal{width:min(440px,100%);background:var(--dsw-alias-bg-layer-1,#1b1b1b);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.32));border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.45);padding:16px}',
      '.cb-modal-title{font-size:14px;font-weight:650;margin-bottom:8px}',
      '.cb-modal-copy{font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,#b0b0b0);display:grid;gap:6px}',
      '.cb-modal-copy strong{color:var(--dsw-alias-label-primary,#e8e8e8);font-weight:600}',
      '.cb-modal-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-top:14px}',
      '.cb-kv{display:grid;grid-template-columns:82px minmax(0,1fr);gap:5px 10px;font-size:12px;align-items:baseline}',
      '.cb-kv-label{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:11px}',
      '.cb-kv-value{min-width:0;overflow-wrap:anywhere}',
      '.cb-code{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:11px;color:var(--dsw-alias-label-secondary,#9a9a9a);overflow-wrap:anywhere;word-break:break-all;white-space:pre-wrap}',
      '.cb-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}',
      '.cb-btn{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.32));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,#e8e8e8);border-radius:8px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}',
      '.cb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.cb-btn.primary{background:var(--dsw-alias-button-primary-fill,#3b82f6);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:600}',
      '.cb-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary,#9a9a9a);padding-left:6px;padding-right:6px}',
      '.cb-btn.ghost:hover{color:var(--dsw-alias-label-primary,#e8e8e8);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.cb-btn.danger{color:var(--dsw-alias-state-error-primary,#f87171)}',
      '.cb-btn:disabled{opacity:.45;cursor:default}',
      '.cb-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-radius:999px;padding:1px 8px;font-size:10px;color:var(--dsw-alias-label-secondary,#9a9a9a);white-space:nowrap}',
      '.cb-chip.ok{color:var(--dsw-alias-state-success-primary,#34d399)}',
      '.cb-chip.warn{color:var(--dsw-alias-state-warn-primary,#fbbf24)}',
      '.cb-chip.err{color:var(--dsw-alias-state-error-primary,#f87171)}',
      '.cb-banner{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-radius:10px;padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-secondary,#9a9a9a);margin-bottom:10px;overflow-wrap:anywhere}',
      '.cb-banner.error{color:var(--dsw-alias-state-error-primary,#f87171);border-color:var(--dsw-alias-state-error-primary,#f87171)}',
      '.cb-progress-block{margin-top:8px}',
      '.cb-progress-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#9a9a9a)}',
      '.cb-progress{height:6px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.16));border-radius:999px;overflow:hidden;margin-top:6px}',
      '.cb-progress>span{display:block;height:100%;background:var(--dsw-alias-brand-primary,#3b82f6);transition:width .2s ease}',
      '.cb-table-wrap{overflow-x:auto;margin-top:6px}',
      '.cb-table{width:100%;border-collapse:collapse;font-size:11px}',
      '.cb-table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary,#8b8b8b);padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));white-space:nowrap}',
      '.cb-table td{padding:5px 6px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));vertical-align:top;overflow-wrap:anywhere}',
      '.cb-table tr:last-child td{border-bottom:0}',
      '.cb-list-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));font-size:12px}',
      '.cb-list-row:last-child{border-bottom:0}',
      '.cb-list-main{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}',
      '.cb-list-side{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:11px;white-space:nowrap;text-align:right;justify-self:end;font-variant-numeric:tabular-nums}',
      '.cb-role-limit{display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;width:140px;flex:none}',
      '.cb-side-label{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b8b8b);white-space:nowrap}',
      '.cb-ratio{display:inline-grid;grid-template-columns:26px 8px 30px;align-items:baseline;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#9a9a9a)}',
      '.cb-ratio-num{text-align:right;padding-right:2px}',
      '.cb-ratio-slash{text-align:center;color:var(--dsw-alias-label-tertiary,#8b8b8b)}',
      '.cb-ratio-den{text-align:left;padding-left:2px}',
      '.cb-section-label{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8b8b8b);margin:10px 0 2px}',
      '.cb-details{margin-top:8px}',
      '.cb-details summary{cursor:pointer;color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:11px}',
      '.cb-details summary:focus{outline:none}',
      '.cb-empty{color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:12px;padding:4px 0}',
      '.cb-error{color:var(--dsw-alias-state-error-primary,#f87171);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.cb-textarea{width:100%;min-height:112px;resize:vertical;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;color:var(--dsw-alias-label-primary,#e8e8e8);padding:8px;font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:11px;line-height:1.5}',
      '.cb-select{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,#e8e8e8);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;padding:4px 6px;font:inherit;font-size:11px}',
      '.cb-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,#e8e8e8);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;padding:6px 8px;font:inherit;font-size:11px}',
      '.cb-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}',
      '.cb-form-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}',
      '.cb-form-row .cb-input{flex:1;min-width:150px}',
      '.cb-field{display:flex;flex-direction:column;gap:3px;margin-top:8px;min-width:0}',
      '.cb-field-label{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b8b8b);letter-spacing:.02em}',
      '.cb-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.cb-checkbox{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary,#9a9a9a)}',
      '.cb-file{font-size:11px;color:var(--dsw-alias-label-secondary,#9a9a9a);max-width:100%}',
      '.cb-sql-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}',
      '.cb-check{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#9a9a9a);font-size:11px}',
      '.cb-result{margin-top:8px}',
      '.cb-result-head{display:flex;gap:8px;align-items:center;color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:10px;letter-spacing:.03em;text-transform:uppercase}',
      '.cb-root button:focus{outline:none}',
      '.cb-root button:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#3b82f6));outline-offset:2px}',
      '.cb-root select:focus,.cb-root textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}',
    ].join('\n')

    function requestFrom(base, path, options) {
      var opts = Object.assign({}, options || {})
      opts.credentials = 'same-origin'
      opts.headers = Object.assign({}, opts.headers || {})
      if (opts.body !== undefined && typeof opts.body !== 'string') {
        opts.body = JSON.stringify(opts.body)
        if (!opts.headers['content-type']) opts.headers['content-type'] = 'application/json'
      }
      return fetch(base + path, opts).then(function (response) {
        return response.text().then(function (text) {
          var data = null
          try {
            data = text ? JSON.parse(text) : null
          } catch (error) {
            data = { error: { message: text } }
          }
          if (!response.ok) {
            var failure = new Error((data && data.error && data.error.message) || 'HTTP ' + response.status)
            failure.status = response.status
            failure.data = data
            throw failure
          }
          return data
        })
      })
    }

    function request(path, options) {
      return requestFrom(API, path, options)
    }

    function configRequest(path, options) {
      return requestFrom(CONFIG_API, path, options)
    }

    function embeddingRequest(path, options) {
      return requestFrom(EMBEDDING_API, path, options)
    }

    function memoryRequest(path, options) {
      return requestFrom(MEMORY_API, path, options)
    }

    function inspectGguf(filePath) {
      return embeddingRequest('/gguf?path=' + encodeURIComponent(filePath))
    }

    function formatBytes(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      var units = ['B', 'KB', 'MB', 'GB']
      var size = value
      var index = 0
      while (size >= 1024 && index < units.length - 1) {
        size /= 1024
        index += 1
      }
      return (index === 0 ? String(size) : size.toFixed(1)) + ' ' + units[index]
    }

    function embeddingStorageStrategy(dimensions) {
      var dim = Number(dimensions) || 0
      if (dim <= 0) return '—'
      return dim < 2000 ? 'vector(' + dim + ')' : 'halfvec(' + dim + ')'
    }

    function embeddingIndexStrategy(dimensions) {
      var dim = Number(dimensions) || 0
      if (dim <= 0) return '—'
      if (dim < 2000) return '全维 vector HNSW'
      if (dim <= 4000) return '全维 halfvec HNSW'
      return 'halfvec(4000) 前缀 HNSW + 全量 halfvec rerank（需 MRL）'
    }

    function formatValue(value) {
      if (value === null || value === undefined) return 'NULL'
      if (typeof value === 'string') return value
      try {
        return JSON.stringify(value)
      } catch (error) {
        return String(value)
      }
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text)
      var area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } catch (error) {
      }
      document.body.removeChild(area)
      return Promise.resolve()
    }

    var PHASE_LABELS = {
      downloading: '下载',
      verifying: '校验',
      extracting: '解压',
      building: '编译扩展',
      initdb: '初始化',
      starting: '启动',
      provisioning: '创建角色',
      ready: '完成',
      stopping: '停止',
      error: '错误',
    }

    function phaseLabel(phase) {
      return PHASE_LABELS[phase] || phase
    }

    function Dot(props) {
      return h('span', { className: 'cb-dot ' + (props.tone || 'idle') })
    }

    function Chip(props) {
      return h('span', { className: 'cb-chip' + (props.tone ? ' ' + props.tone : '') }, props.children)
    }

    function Metric(props) {
      return h(
        'div',
        { className: 'cb-metric' },
        h('div', { className: 'cb-metric-label' }, props.label),
        h('div', { className: 'cb-metric-value' }, props.value),
        props.hint ? h('div', { className: 'cb-metric-hint' }, props.hint) : null,
      )
    }

    function KV(props) {
      return h(
        'div',
        { className: 'cb-kv' },
        h('span', { className: 'cb-kv-label' }, props.label),
        h('span', { className: 'cb-kv-value' + (props.mono ? ' cb-code' : '') }, props.children),
      )
    }

    function Card(props) {
      return h(
        'section',
        { className: 'cb-card' },
        props.title
          ? h('div', { className: 'cb-card-head' },
              h('div', { className: 'cb-card-title' }, props.title, props.sub ? h('span', { className: 'cb-card-sub' }, props.sub) : null),
              props.right || null,
            )
          : null,
        props.children,
        props.actions ? h('div', { className: 'cb-actions' }, props.actions) : null,
      )
    }

    function Banner(props) {
      return h('div', { className: 'cb-banner' + (props.tone ? ' ' + props.tone : '') }, props.children)
    }

    function CopyButton(props) {
      var copiedState = useState(false)
      var copied = copiedState[0]
      var setCopied = copiedState[1]
      return h(
        'button',
        {
          type: 'button',
          className: 'cb-btn ghost',
          onClick: function () {
            copyText(props.text).then(function () {
              setCopied(true)
              setTimeout(function () {
                setCopied(false)
              }, 1200)
            })
          },
        },
        copied ? '已复制' : props.label || '复制',
      )
    }

    function OperationProgress(props) {
      var operation = props.operation
      if (!operation) return null
      var percent = typeof operation.progress === 'number' ? Math.max(0, Math.min(1, operation.progress)) : null
      return h(
        'div',
        { className: 'cb-progress-block' },
        h('div', { className: 'cb-progress-head' },
          h(Dot, { tone: 'ok' }),
          h('span', null, phaseLabel(operation.phase)),
          operation.message ? h('span', { className: 'cb-list-side' }, operation.message) : null,
        ),
        percent === null ? null : h('div', { className: 'cb-progress' }, h('span', { style: { width: Math.round(percent * 100) + '%' } })),
      )
    }

    function describeStatus(status) {
      if (status.lastError && !status.running) return { tone: 'err', label: '异常', description: status.lastError }
      if (!status.installed) return { tone: 'idle', label: '未安装', description: '尚未初始化 PostgreSQL 服务。安装后由 memory 子系统管理。' }
      if (!status.running) return { tone: 'warn', label: '已停止', description: '服务已安装但未运行。启动后记忆与 SQL Prompt 可用。' }
      return { tone: 'ok', label: '运行中', description: 'PostgreSQL 正在 127.0.0.1:' + status.port + ' 接受连接。' }
    }

    function StatusHero(props) {
      var status = props.status
      var source = status.catalog || {}
      var info = describeStatus(status)
      var pgVersion = status.pgVersion || source.pgVersion || '18.6'
      var vectorVersion = status.pgvectorVersion || source.pgvectorVersion || '0.8.7'
      var busy = props.busy
      var installing = status.operation !== null && status.operation !== undefined
      var blocked = busy || installing
      var actions = []
      if (!status.installed) {
        actions.push(h('button', { key: 'install', type: 'button', className: 'cb-btn primary', disabled: blocked, onClick: props.onInstall }, installing ? '安装中…' : '安装 PostgreSQL'))
      } else if (status.running) {
        actions.push(h('button', { key: 'stop', type: 'button', className: 'cb-btn', disabled: blocked, onClick: function () { props.onAction('stop') } }, '停止'))
        actions.push(h('button', { key: 'restart', type: 'button', className: 'cb-btn', disabled: blocked, onClick: function () { props.onAction('restart') } }, '重启'))
      } else {
        actions.push(h('button', { key: 'start', type: 'button', className: 'cb-btn primary', disabled: blocked, onClick: function () { props.onAction('start') } }, '启动'))
      }
      actions.push(h('button', { key: 'refresh', type: 'button', className: 'cb-btn ghost', disabled: busy, onClick: props.onRefresh }, '刷新'))

      return h(
        Card,
        {
          title: '数据库服务',
          sub: 'EDB official binaries',
          right: h(Chip, null, 'PG ' + pgVersion),
        },
        h('div', { className: 'cb-hero-head' },
          h(Dot, { tone: info.tone }),
          h('span', { className: 'cb-hero-state' }, info.label),
          h(Chip, { tone: info.tone === 'ok' ? 'ok' : info.tone === 'err' ? 'err' : info.tone === 'warn' ? 'warn' : null }, 'official'),
        ),
        h('div', { className: 'cb-hero-desc' }, info.description),
        h('div', { className: 'cb-metrics' },
          h(Metric, { label: 'PostgreSQL', value: pgVersion, hint: 'official EDB' }),
          h(Metric, { label: 'pgvector', value: vectorVersion, hint: 'built from source' }),
          h(Metric, { label: '端口', value: status.port === null || status.port === undefined ? '—' : String(status.port), hint: '127.0.0.1' }),
          h(Metric, { label: '数据库', value: status.database || 'claybot', hint: 'schema core / memory' }),
        ),
        status.installed
          ? h('details', { className: 'cb-details' },
              h('summary', null, '安装路径'),
              h('div', { style: { marginTop: 6 } },
                h(KV, { label: '数据目录', mono: true }, status.dataDir),
                h(KV, { label: '程序目录', mono: true }, status.binDir),
              ),
            )
          : null,
        status.operation ? h(OperationProgress, { operation: status.operation }) : null,
        status.lastError ? h('div', { className: 'cb-error', style: { marginTop: 8 } }, '错误：' + status.lastError) : null,
        h('div', { className: 'cb-actions' }, actions),
      )
    }

    function InstallPanel(props) {
      var source = props.catalog
      if (!source) {
        return h(Card, { title: '安装数据库', sub: '首次初始化', right: h(Chip, { tone: 'warn' }, '需要确认') },
          h('div', { className: 'cb-empty' }, '正在读取安装源信息…'),
        )
      }
      var pgVersion = source.pgVersion || '18.6'
      return h(
        Card,
        { title: '安装数据库', sub: '官方 EDB PostgreSQL', right: h(Chip, { tone: 'warn' }, '需要确认') },
        h('div', { className: 'cb-hero-desc' }, '从官方 EDB 下载 PostgreSQL ' + pgVersion + ' Windows x64 二进制；pgvector ' + source.pgvectorVersion + ' 安装时下载官方源码并本地编译（需要 VS2022 C++ 工具链）。安装到 memory 子系统的数据目录，不写入 npm 包目录。'),
        h('div', { className: 'cb-metrics' },
          h(Metric, { label: 'PostgreSQL', value: pgVersion, hint: 'official EDB' }),
          h(Metric, { label: 'pgvector', value: source.pgvectorVersion, hint: 'built from source' }),
          h(Metric, { label: '安装包', value: formatBytes(source.size), hint: 'download' }),
          h(Metric, { label: '平台', value: 'Windows x64', hint: source.platform }),
        ),
        h('details', { className: 'cb-details' },
          h('summary', null, '来源与校验'),
          h('div', { className: 'cb-hero-desc', style: { marginTop: 6, marginBottom: 4 } },
            'PostgreSQL: 官方 EDB Windows x64 二进制（installerVersion ' + source.version + '）。pgvector: 官方 v' + source.pgvectorVersion + ' 源码，安装时下载到 stateDir/db/build 并用 VS2022/MSVC 本地编译；不随插件分发二进制。',
          ),
          h('div', { className: 'cb-code' }, source.url),
          h('div', { className: 'cb-card-sub', style: { marginTop: 4, whiteSpace: 'normal' } }, 'pgvector 源码: https://github.com/pgvector/pgvector/tree/v' + source.pgvectorVersion),
          h('div', { className: 'cb-card-sub', style: { marginTop: 4, whiteSpace: 'normal' } }, source.license + ' · SHA-256 '),
          h('div', { className: 'cb-code' }, source.sha256),
        ),
        h('div', { className: 'cb-actions' },
          h('button', { type: 'button', className: 'cb-btn primary', disabled: props.busy, onClick: props.onConfirm }, '确认下载并安装'),
          h('button', { type: 'button', className: 'cb-btn', disabled: props.busy, onClick: props.onCancel }, '取消'),
        ),
      )
    }

    function ConnectionCard(props) {
      var status = props.status
      if (!status.installed) return null
      var connection = props.connection
      var password = props.password
      if (!connection) {
        return h(Card, { title: '连接', sub: 'admin' },
          h('div', { className: 'cb-empty' }, '加载 admin 连接信息'),
          h('div', { className: 'cb-actions' }, h('button', { type: 'button', className: 'cb-btn', onClick: props.onLoad }, '加载连接信息')),
        )
      }
      var psql = '"' + (status.binDir || 'psql') + '\\psql.exe" -h 127.0.0.1 -p ' + connection.port + ' -U ' + connection.user + ' -d ' + connection.database
      var dsn = 'postgresql://' + connection.user + (password ? ':' + encodeURIComponent(password) : '') + '@' + connection.host + ':' + connection.port + '/' + connection.database
      return h(
        Card,
        { title: '连接', sub: 'admin', right: h(Chip, { tone: 'ok' }, 'loopback') },
        h(KV, { label: '主机' }, connection.host),
        h(KV, { label: '端口' }, String(connection.port)),
        h(KV, { label: '数据库' }, connection.database),
        h(KV, { label: '用户' }, connection.user),
        h(KV, { label: '密码', mono: true }, password || '••••••••'),
        h('div', { className: 'cb-actions' },
          h('button', { type: 'button', className: 'cb-btn', onClick: password ? props.onHide : props.onReveal }, password ? '隐藏密码' : '显示密码'),
          h(CopyButton, { label: '复制连接串', text: dsn }),
          h(CopyButton, { label: '复制 psql 命令', text: psql }),
        ),
        h('div', { className: 'cb-card-sub', style: { marginTop: 8, whiteSpace: 'normal' } }, 'PG 只监听 127.0.0.1；外部工具需在同一台机器或走 SSH 隧道。'),
      )
    }

    function RolesCard(props) {
      if (!props.status.installed) return null
      if (!props.status.running) {
        return h(Card, { title: '角色与 Schema', sub: '数据库未运行' },
          h('div', { className: 'cb-empty' }, '数据库未运行，启动后显示角色与 schema。'),
        )
      }
      var data = props.dbinfo
      var connectionsData = props.connections
      var connectedByUser = {}
      if (connectionsData && Array.isArray(connectionsData.connections)) {
        for (var c = 0; c < connectionsData.connections.length; c += 1) {
          var connection = connectionsData.connections[c]
          if (!connection.user) continue
          connectedByUser[connection.user] = (connectedByUser[connection.user] || 0) + 1
        }
      }
      var sizeBySchema = {}
      if (data && Array.isArray(data.sizes)) {
        for (var i = 0; i < data.sizes.length; i += 1) sizeBySchema[data.sizes[i].schema] = data.sizes[i].size
      }
      var body = []
      if (props.error) body.push(h('div', { className: 'cb-error' }, props.error))
      else if (!data) body.push(h('div', { className: 'cb-empty' }, '加载中…'))
      else {
        body.push(h('div', { className: 'cb-section-label' }, '角色'))
        if (!data.roles || data.roles.length === 0) body.push(h('div', { className: 'cb-empty' }, '无角色'))
        ;(data.roles || []).forEach(function (role) {
          var limit = Number(role.rolconnlimit)
          var connected = connectedByUser[role.rolname] || 0
          var connectedText = connectionsData ? String(connected) : '—'
          var availableText = limit < 0 ? '∞' : connectionsData ? String(Math.max(0, limit - connected)) : String(limit)
          body.push(
            h('div', { className: 'cb-list-row', key: 'role-' + role.rolname },
              h('div', { className: 'cb-list-main' },
                h(Dot, { tone: role.rolcanlogin ? 'ok' : 'idle' }),
                h('span', { className: 'cb-code' }, role.rolname),
                role.rolsuper ? h(Chip, { tone: 'warn' }, 'super') : null,
              ),
              h('div', { className: 'cb-list-side cb-role-limit' },
                h('span', { className: 'cb-side-label' }, '已连接/可用'),
                h('span', { className: 'cb-ratio', 'aria-label': '已连接 ' + connectedText + '，可用 ' + availableText },
                  h('span', { className: 'cb-ratio-num' }, connectedText),
                  h('span', { className: 'cb-ratio-slash' }, '/'),
                  h('span', { className: 'cb-ratio-den' }, availableText),
                ),
              ),
            ),
          )
        })
        body.push(h('div', { className: 'cb-section-label' }, 'Schema'))
        if (!data.schemas || data.schemas.length === 0) body.push(h('div', { className: 'cb-empty' }, '无 schema'))
        ;(data.schemas || []).forEach(function (schema) {
          body.push(
            h('div', { className: 'cb-list-row', key: 'schema-' + schema.name },
              h('div', { className: 'cb-list-main' },
                h(Dot, { tone: 'ok' }),
                h('span', { className: 'cb-code' }, schema.name),
              ),
              h('div', { className: 'cb-list-side' }, schema.owner + (sizeBySchema[schema.name] ? ' · ' + sizeBySchema[schema.name] : '')),
            ),
          )
        })
      }
      return h(
        Card,
        {
          title: '角色与 Schema',
          sub: data && data.databaseSize ? data.databaseSize : null,
          right: h('button', { type: 'button', className: 'cb-btn ghost', onClick: props.onRefresh }, '刷新'),
        },
        body,
      )
    }

    function SqlPanel(props) {
      var status = props.status
      var sqlState = useState('select version() as version, current_database() as db, current_user as role;')
      var sql = sqlState[0]
      var setSql = sqlState[1]
      var roleState = useState('admin')
      var role = roleState[0]
      var setRole = roleState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var resultState = useState(null)
      var result = resultState[0]
      var setResult = resultState[1]
      var errorState = useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      var confirmState = useState(false)
      var confirmWrite = confirmState[0]
      var setConfirmWrite = confirmState[1]

      var readOnly = /^\s*(select|show|explain|with|values|table)\b/i.test(sql) || sql.trim().length === 0
      var canRun = status.running && !busy && sql.trim().length > 0 && (readOnly || confirmWrite)

      function run() {
        if (!canRun) return
        setBusy(true)
        setError(null)
        setResult(null)
        request('/query', { method: 'POST', body: { role: role, sql: sql } })
          .then(function (value) { setResult(value) })
          .catch(function (failure) {
            setError(failure.data && failure.data.error ? failure.data.error : { message: failure.message })
          })
          .then(function () { setBusy(false) })
      }

      var snippets = [
        { label: '版本', sql: 'select version() as version, current_database() as db, current_user as role;' },
        { label: '角色', sql: "select rolname, rolsuper, rolcanlogin, rolconnlimit from pg_roles where rolname like 'claybot%' or rolname like 'provider_%' order by 1;" },
        { label: 'Schema', sql: "select nspname as name, pg_get_userbyid(nspowner) as owner from pg_namespace where nspname in ('core','memory') or nspname like 'provider_%';" },
        { label: '表大小', sql: "select n.nspname as schema, c.relname as table, pg_size_pretty(pg_total_relation_size(c.oid)) as size from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') order by 3 desc limit 50;" },
      ]

      if (!status.running) {
        return h(Card, { title: 'SQL Prompt', sub: 'admin' }, h('div', { className: 'cb-empty' }, '数据库未运行，启动后才能执行 SQL。'))
      }

      return h(
        Card,
        {
          title: 'SQL Prompt',
          sub: role,
          right: h('select', {
            className: 'cb-select',
            value: role,
            onChange: function (event) { setRole(event.target.value) },
          },
            h('option', { value: 'admin' }, 'admin'),
            h('option', { value: 'core' }, 'core'),
            h('option', { value: 'memory' }, 'memory'),
          ),
        },
        h('textarea', {
          className: 'cb-textarea',
          spellCheck: false,
          value: sql,
          onChange: function (event) { setSql(event.target.value); setConfirmWrite(false) },
        }),
        h('div', { className: 'cb-sql-actions' },
          h('button', { type: 'button', className: 'cb-btn primary', disabled: !canRun, onClick: run }, busy ? '执行中…' : 'Run'),
          h('span', { className: 'cb-card-sub' }, readOnly ? '只读' : '写操作'),
          !readOnly
            ? h('label', { className: 'cb-check' },
                h('input', { type: 'checkbox', checked: confirmWrite, onChange: function (event) { setConfirmWrite(event.target.checked) } }),
                '确认执行',
              )
            : null,
        ),
        h('div', { className: 'cb-actions' }, snippets.map(function (snippet) {
          return h('button', {
            key: snippet.label,
            type: 'button',
            className: 'cb-btn ghost',
            onClick: function () { setSql(snippet.sql); setConfirmWrite(false); setResult(null); setError(null) },
          }, snippet.label)
        })),
        error
          ? h('div', { className: 'cb-error', style: { marginTop: 8 } },
              '错误：' + (error.message || 'unknown') +
                (error.code ? ' [' + error.code + ']' : '') +
                (error.detail ? '\n' + error.detail : '') +
                (error.hint ? '\nhint: ' + error.hint : '') +
                (error.position ? '\nposition: ' + error.position : ''),
            )
          : null,
        result
          ? h('div', null, (result.results || []).map(function (item, index) {
              return h('div', { className: 'cb-result', key: index },
                h('div', { className: 'cb-result-head' },
                  h('span', null, item.command || 'result'),
                  h('span', null, 'rows ' + String(item.rowCount === null ? '—' : item.rowCount)),
                  item.truncated ? h('span', null, '显示前 ' + String(result.maxRows || MAX_ROWS) + ' 行') : null,
                ),
                item.fields && item.fields.length > 0
                  ? h('div', { className: 'cb-table-wrap' },
                      h('table', { className: 'cb-table' },
                        h('thead', null, h('tr', null, item.fields.map(function (field) { return h('th', { key: field }, field) }))),
                        h('tbody', null, (item.rows || []).map(function (row, rowIndex) {
                          return h('tr', { key: rowIndex }, item.fields.map(function (field) {
                            return h('td', { key: field }, formatValue(row[field]))
                          }))
                        })),
                      ),
                    )
                  : null,
              )
            }))
          : null,
      )
    }

    function useStatus() {
      var statusState = useState(null)
      var status = statusState[0]
      var setStatus = statusState[1]
      var errorState = useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var load = useCallback(function () {
        return request('/status')
          .then(function (value) {
            setStatus(value)
            setError('')
          })
          .catch(function (failure) {
            setError(failure.message)
          })
      }, [])
      useEffect(function () {
        load()
        var timer = setInterval(load, 1500)
        return function () { clearInterval(timer) }
      }, [load])
      return { status: status, error: error, reload: load }
    }

    function useConnections(running) {
      var dataState = useState(null)
      var data = dataState[0]
      var setData = dataState[1]
      var errorState = useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var load = useCallback(function () {
        if (!running) {
          setData(null)
          setError('')
          return Promise.resolve()
        }
        return request('/connections')
          .then(function (value) {
            setData(value)
            setError('')
          })
          .catch(function (failure) {
            setData(null)
            setError(failure.message)
          })
      }, [running])
      useEffect(function () {
        load()
        var timer = setInterval(load, 5000)
        return function () { clearInterval(timer) }
      }, [load])
      return { data: data, error: error, reload: load }
    }

    function connectionApp(connection) {
      return connection.application || 'client'
    }

    function connectionTarget(connection) {
      var parts = []
      if (connection.user) parts.push(connection.user)
      if (connection.database) parts.push(connection.database)
      return parts.length > 0 ? parts.join('@') : '—'
    }

    function connectionTone(state) {
      if (!state) return 'idle'
      if (state === 'active') return 'ok'
      if (state.indexOf('idle') === 0) return 'idle'
      return 'warn'
    }

    function ConnectionSummary(props) {
      var status = props.status
      var data = props.data
      var error = props.error
      var body = []
      if (!status.installed) body.push(h('div', { className: 'cb-empty' }, '安装并启动后显示客户端连接。'))
      else if (!status.running) body.push(h('div', { className: 'cb-empty' }, '数据库未运行。'))
      else if (error) body.push(h('div', { className: 'cb-error' }, error))
      else if (!data) body.push(h('div', { className: 'cb-empty' }, '加载中…'))
      else if (data.count === 0) body.push(h('div', { className: 'cb-empty' }, '当前没有客户端连接。'))
      else {
        var shown = data.connections.slice(0, 5)
        ;(shown || []).forEach(function (connection) {
          body.push(
            h('div', { className: 'cb-list-row', key: 'conn-' + connection.pid },
              h('div', { className: 'cb-list-main' },
                h(Dot, { tone: connectionTone(connection.state) }),
                h('span', { className: 'cb-code' }, connectionApp(connection)),
                h('span', { className: 'cb-card-sub', style: { whiteSpace: 'normal' } }, connectionTarget(connection)),
              ),
              h('div', { className: 'cb-list-side' }, connection.state || '—'),
            ),
          )
        })
        if (data.count > shown.length) body.push(h('div', { className: 'cb-empty' }, '还有 ' + String(data.count - shown.length) + ' 个连接'))
      }
      return h(
        Card,
        {
          title: '客户端连接',
          sub: data && typeof data.count === 'number' ? String(data.count) + ' 个' : null,
          right: h('button', { type: 'button', className: 'cb-btn ghost', onClick: props.onOpen }, '查看全部'),
        },
        body,
      )
    }

    function ConnectionsCard(props) {
      var status = props.status
      var data = props.data
      var error = props.error
      var body = []
      if (!status.running) body.push(h('div', { className: 'cb-empty' }, '数据库未运行。'))
      else if (error) body.push(h('div', { className: 'cb-error' }, error))
      else if (!data) body.push(h('div', { className: 'cb-empty' }, '加载中…'))
      else if (data.count === 0) body.push(h('div', { className: 'cb-empty' }, '当前没有客户端连接。'))
      else {
        ;(data.connections || []).forEach(function (connection) {
          body.push(
            h('div', { className: 'cb-list-row', key: 'conn-' + connection.pid },
              h('div', { className: 'cb-list-main' },
                h(Dot, { tone: connectionTone(connection.state) }),
                h('span', { className: 'cb-code' }, connectionApp(connection)),
                h('span', { className: 'cb-card-sub', style: { whiteSpace: 'normal' } }, connectionTarget(connection) + (connection.client ? ' · ' + connection.client : '')),
              ),
              h('div', { className: 'cb-list-side' }, 'pid ' + String(connection.pid) + ' · ' + (connection.state || '—')),
            ),
          )
        })
      }
      return h(
        Card,
        {
          title: '连接对象',
          sub: data && typeof data.count === 'number' ? String(data.count) + ' 个' : null,
          right: h('button', { type: 'button', className: 'cb-btn ghost', onClick: props.onRefresh }, '刷新'),
        },
        body,
      )
    }

    function cloneJson(value) {
      return JSON.parse(JSON.stringify(value))
    }

    function setJsonPath(root, parts, value) {
      var next = cloneJson(root)
      var cursor = next
      for (var index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]]
      cursor[parts[parts.length - 1]] = value
      return next
    }

    function downloadJson(name, value) {
      var blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
      var url = URL.createObjectURL(blob)
      var anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
    }

    function ConfigField(props) {
      return h(
        'label',
        { className: 'cb-field' },
        h('span', { className: 'cb-field-label' }, props.label),
        props.children,
        props.hint ? h('span', { className: 'cb-card-sub', style: { whiteSpace: 'normal' } }, props.hint) : null,
      )
    }

    function ConfigText(props) {
      return h(
        ConfigField,
        { label: props.label, hint: props.hint },
        h('input', {
          className: 'cb-input',
          type: props.type || 'text',
          value: props.value === undefined || props.value === null ? '' : props.value,
          placeholder: props.placeholder || '',
          spellCheck: false,
          onChange: function (event) { props.onChange(event.target.value) },
        }),
      )
    }

    function ConfigNumber(props) {
      return h(
        ConfigField,
        { label: props.label, hint: props.hint },
        h('input', {
          className: 'cb-input',
          type: 'number',
          value: props.value === undefined || props.value === null ? '' : props.value,
          min: props.min,
          max: props.max,
          onChange: function (event) {
            var text = event.target.value
            props.onChange(text === '' ? 0 : Number(text))
          },
        }),
      )
    }

    function ConfigSelect(props) {
      return h(
        ConfigField,
        { label: props.label, hint: props.hint },
        h('select', {
          className: 'cb-select',
          value: props.value,
          onChange: function (event) { props.onChange(event.target.value) },
        }, (props.options || []).map(function (item) {
          var value = Array.isArray(item) ? item[0] : item
          var label = Array.isArray(item) ? item[1] : item
          return h('option', { value: value, key: value }, label)
        })),
      )
    }

    function ConfigPage() {
      var configState = useState(null)
      var config = configState[0]
      var setConfig = configState[1]
      var draftState = useState(null)
      var draft = draftState[0]
      var setDraft = draftState[1]
      var devicesState = useState(null)
      var devices = devicesState[0]
      var setDevices = devicesState[1]
      var errorState = useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var noticeState = useState('')
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var savingState = useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]
      var exportingState = useState(false)
      var exporting = exportingState[0]
      var setExporting = exportingState[1]
      var previewingState = useState(false)
      var previewing = previewingState[0]
      var setPreviewing = previewingState[1]
      var applyingState = useState(false)
      var applying = applyingState[0]
      var setApplying = applyingState[1]
      var includeSecretsState = useState(false)
      var includeSecrets = includeSecretsState[0]
      var setIncludeSecrets = includeSecretsState[1]
      var importTextState = useState('')
      var importText = importTextState[0]
      var setImportText = importTextState[1]
      var previewState = useState(null)
      var preview = previewState[0]
      var setPreview = previewState[1]

      var loadConfig = useCallback(function () {
        return configRequest('/config')
          .then(function (value) {
            setConfig(value)
            setDraft({ embedding: cloneJson(value.embedding), device: cloneJson(value.device) })
            setError('')
          })
          .catch(function (failure) { setError(failure.message) })
      }, [])

      var loadDevices = useCallback(function () {
        return configRequest('/devices')
          .then(function (value) { setDevices(value) })
          .catch(function (failure) { setError(failure.message) })
      }, [])

      useEffect(function () {
        loadConfig()
        loadDevices()
      }, [loadConfig, loadDevices])

      function update(parts, value) {
        setDraft(function (previous) { return setJsonPath(previous, parts, value) })
      }

      function save() {
        setSaving(true)
        setError('')
        setNotice('')
        configRequest('/config', {
          method: 'PUT',
          body: { embedding: draft.embedding, device: draft.device, database: { backupDir: config.database.backupDir } },
        })
          .then(function (value) {
            setConfig(value)
            setDraft({ embedding: cloneJson(value.embedding), device: cloneJson(value.device) })
            setNotice('配置已保存')
          })
          .catch(function (failure) { setError(failure.message) })
          .then(function () { setSaving(false) })
      }

      function refreshDevices() {
        setError('')
        loadDevices().then(function () { setNotice('设备信息已刷新') })
      }

      function exportConfig() {
        setExporting(true)
        setError('')
        setNotice('')
        configRequest('/config/export?secrets=' + (includeSecrets ? '1' : '0'))
          .then(function (value) {
            downloadJson('claybot-config-' + Date.now() + '.json', value)
            setNotice(includeSecrets ? '配置单已导出（含明文密钥）' : '配置单已导出（密钥已脱敏）')
          })
          .catch(function (failure) { setError(failure.message) })
          .then(function () { setExporting(false) })
      }

      function readImportFile(event) {
        var file = event.target.files && event.target.files[0]
        if (!file) return
        file.text()
          .then(function (text) {
            setImportText(text)
            setPreview(null)
            setNotice('已读取配置单，请预览导入')
          })
          .catch(function (failure) { setError(failure.message) })
        event.target.value = ''
      }

      function parseImportText() {
        try {
          return JSON.parse(importText)
        } catch (failure) {
          throw new Error('配置单 JSON 无效：' + (failure instanceof Error ? failure.message : String(failure)))
        }
      }

      function previewImport() {
        setPreviewing(true)
        setError('')
        setNotice('')
        try {
          var sheet = parseImportText()
          configRequest('/config/import', { method: 'POST', body: { sheet: sheet, apply: false } })
            .then(function (value) {
              setPreview(value)
              setNotice(value.changes.length === 0 ? '配置无变化' : '预览完成，确认后应用')
            })
            .catch(function (failure) { setError(failure.message) })
            .then(function () { setPreviewing(false) })
        } catch (failure) {
          setError(failure.message)
          setPreviewing(false)
        }
      }

      function applyImport() {
        setApplying(true)
        setError('')
        setNotice('')
        try {
          var sheet = parseImportText()
          configRequest('/config/import', { method: 'POST', body: { sheet: sheet, apply: true } })
            .then(function (value) {
              setPreview(value)
              setNotice('配置已导入')
              return loadConfig()
            })
            .catch(function (failure) { setError(failure.message) })
            .then(function () { setApplying(false) })
        } catch (failure) {
          setError(failure.message)
          setApplying(false)
        }
      }

      if (!config && error) {
        return h(Card, { title: '配置', right: h(Chip, { tone: 'err' }, '不可用') }, h('div', { className: 'cb-error' }, error))
      }
      if (!config || !draft) {
        return h(Card, { title: '配置' }, h('div', { className: 'cb-empty' }, '加载中…'))
      }

      var embedding = draft.embedding

      return h('div', null,
        error ? h(Banner, { tone: 'error' }, error) : null,
        notice ? h(Banner, null, notice) : null,
        h('div', { className: 'cb-form-row', style: { marginBottom: 10 } },
          h('button', { type: 'button', className: 'cb-btn primary', disabled: saving, onClick: save }, saving ? '保存中…' : '保存配置'),
          h('span', { className: 'cb-card-sub' }, '保存到 stateDir/inference.json'),
        ),
        h(Card, { title: '数据库', sub: 'memory subsystem 基础设施' },
          h(KV, { label: 'PostgreSQL' }, config.database.postgresVersion || '—'),
          h(KV, { label: 'pgvector' }, config.database.pgvectorVersion || '—'),
          h(KV, { label: '备份目录', mono: true }, config.database.backupDir),
          h('div', { className: 'cb-card-sub', style: { marginTop: 6, whiteSpace: 'normal' } },
            '数据库版本更新请到「数据库 → 组件」手动执行；配置单会导出当前版本，导入只对比提示，不会自动升级。',
          ),
        ),
        h(Card, { title: 'Embedding', sub: '召回向量 · embedding 方案' },
          h(ConfigSelect, {
            label: '模式',
            value: embedding.mode,
            options: [['remote', '远端 embedding service'], ['llama', 'llama.cpp 本地推理']],
            onChange: function (value) { update(['embedding', 'mode'], value) },
          }),
          h(ConfigNumber, { label: '向量维度 dimensions', value: embedding.dimensions, min: 1, max: 4096, hint: 'vector 可存、也可精确检索 4096 维；但 HNSW/IVFFlat 索引上限为 vector 2000 / halfvec 4000。>2000 建议 halfvec（≤4000）或截断；4096 不建索引可精确扫描，建索引需截断。', onChange: function (value) { update(['embedding', 'dimensions'], value) } }),
          embedding.mode === 'remote'
            ? h('div', null,
                h(ConfigText, { label: 'Base URL', value: embedding.remote.baseUrl, placeholder: 'https://...', onChange: function (value) { update(['embedding', 'remote', 'baseUrl'], value) } }),
                h(ConfigText, { label: 'Model', value: embedding.remote.model, onChange: function (value) { update(['embedding', 'remote', 'model'], value) } }),
                h(ConfigText, { label: 'Embeddings path', value: embedding.remote.path, onChange: function (value) { update(['embedding', 'remote', 'path'], value) } }),
                h(ConfigText, { label: 'API Key', type: 'password', value: embedding.remote.apiKey, placeholder: embedding.remote.hasApiKey ? '已设置，留空保持不变' : '可留空', onChange: function (value) { update(['embedding', 'remote', 'apiKey'], value) } }),
                h(ConfigNumber, { label: 'Batch size', value: embedding.remote.batchSize, min: 1, max: 512, onChange: function (value) { update(['embedding', 'remote', 'batchSize'], value) } }),
              )
            : h('div', null,
                h(ConfigText, { label: 'GGUF 模型路径', value: embedding.llama.model, placeholder: 'C:\\models\\embedding.gguf', onChange: function (value) { update(['embedding', 'llama', 'model'], value) } }),
                h('div', { className: 'cb-field-grid' },
                  h(ConfigSelect, { label: '后端', value: embedding.llama.backend, options: ['auto', 'cpu', 'cuda', 'vulkan'], onChange: function (value) { update(['embedding', 'llama', 'backend'], value) } }),
                  h(ConfigNumber, { label: 'GPU layers', value: embedding.llama.gpuLayers, min: 0, max: 999, onChange: function (value) { update(['embedding', 'llama', 'gpuLayers'], value) } }),
                  h(ConfigNumber, { label: '端口', value: embedding.llama.port, min: 1, max: 65535, onChange: function (value) { update(['embedding', 'llama', 'port'], value) } }),
                ),
              ),
        ),
        h(Card, {
          title: '设备',
          sub: devices && devices.recommended ? '推荐 ' + devices.recommended : '检测中',
          right: h('button', { type: 'button', className: 'cb-btn ghost', onClick: refreshDevices }, '刷新'),
        },
          h(ConfigSelect, {
            label: '设备偏好',
            value: draft.device.prefer,
            options: ['auto', 'cpu', 'cuda', 'vulkan'],
            onChange: function (value) { update(['device', 'prefer'], value) },
          }),
          devices
            ? h('div', null,
                h(KV, { label: 'CPU' }, devices.cpu.model + ' · ' + devices.cpu.cores + ' cores'),
                devices.gpus && devices.gpus.length > 0
                  ? devices.gpus.map(function (gpu, index) {
                      return h(KV, { key: 'gpu-' + index, label: 'GPU ' + (index + 1) }, gpu.name + (gpu.memory ? ' · ' + gpu.memory : ''))
                    })
                  : h('div', { className: 'cb-empty' }, '未检测到 GPU'),
                h(KV, { label: '可用后端' }, (devices.backends || []).join(', ')),
                h(KV, { label: 'CUDA' }, devices.cudaVersion || '—'),
                h(KV, { label: '驱动' }, devices.driverVersion || '—'),
              )
            : h('div', { className: 'cb-empty' }, '设备检测中…'),
        ),
        h(Card, { title: '配置单', sub: 'JSON 导入 / 导出' },
          h('label', { className: 'cb-checkbox' },
            h('input', { type: 'checkbox', checked: includeSecrets, onChange: function (event) { setIncludeSecrets(event.target.checked) } }),
            '导出时包含明文 API Key',
          ),
          h('div', { className: 'cb-form-row' },
            h('button', { type: 'button', className: 'cb-btn', disabled: exporting, onClick: exportConfig }, exporting ? '导出中…' : '导出配置单'),
            h('input', { className: 'cb-file', type: 'file', accept: '.json,application/json', onChange: readImportFile }),
          ),
          h('div', { className: 'cb-card-sub', style: { marginTop: 6, whiteSpace: 'normal' } }, '默认导出会脱敏 API Key；导入时留空的 Key 保持现有值。'),
          h('textarea', {
            className: 'cb-textarea',
            style: { minHeight: 90, marginTop: 8 },
            spellCheck: false,
            placeholder: '粘贴配置单 JSON，或选择文件…',
            value: importText,
            onChange: function (event) { setImportText(event.target.value); setPreview(null) },
          }),
          h('div', { className: 'cb-form-row' },
            h('button', { type: 'button', className: 'cb-btn', disabled: previewing, onClick: previewImport }, previewing ? '预览中…' : '预览导入'),
            h('button', { type: 'button', className: 'cb-btn primary', disabled: applying || preview === null, onClick: applyImport }, applying ? '应用中…' : '应用导入'),
          ),
          preview
            ? h('div', null,
                h('div', { className: 'cb-section-label' }, '变更'),
                preview.changes.length === 0
                  ? h('div', { className: 'cb-empty' }, '无变化')
                  : preview.changes.map(function (change) {
                      return h('div', { className: 'cb-list-row', key: change.path },
                        h('div', { className: 'cb-list-main' },
                          h('span', { className: 'cb-code' }, change.path),
                          h('span', { className: 'cb-card-sub' }, String(change.from) + ' → ' + String(change.to)),
                        ),
                      )
                    }),
                preview.warnings && preview.warnings.length > 0
                  ? h('div', { style: { marginTop: 8 } },
                      h('div', { className: 'cb-section-label' }, '提示'),
                      preview.warnings.map(function (warning, index) {
                        return h('div', { className: 'cb-card-sub', key: index, style: { whiteSpace: 'normal' } }, warning)
                      }),
                    )
                  : null,
              )
          : null,
        ),
      )
    }

    function niceScaleMax(value) {
      if (!Number.isFinite(value) || value <= 0) return 10
      const steps = [1, 2, 5, 10, 20, 25, 50, 100]
      for (const step of steps) {
        if (value <= step) return step
      }
      return Math.ceil(value / 100) * 100
    }

    function Sparkline(props) {
      var values = (props.values || []).filter(function (value) { return typeof value === 'number' && Number.isFinite(value) })
      var format = props.formatValue || function (value) { return Math.round(value) + '%' }
      var dataMin = values.length > 0 ? Math.min.apply(null, values) : 0
      var dataMax = values.length > 0 ? Math.max.apply(null, values) : 0
      var range = dataMax - dataMin
      var padding = Math.max(range * 0.15, Math.abs(dataMax) * 0.03, props.percent === false ? 0 : 0.5)
      var min
      var max
      if (props.percent === false) {
        min = Math.max(0, dataMin - padding)
        max = dataMax + padding
      } else {
        max = niceScaleMax(dataMax + padding)
        min = Math.max(0, Math.floor((dataMin - padding) / 5) * 5)
      }
      if (!Number.isFinite(max) || max <= min) max = min + 1
      var span = max - min
      var points = values.map(function (value, index) {
        var x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100
        var y = 28 - Math.max(0, Math.min(1, (value - min) / span)) * 26
        return x.toFixed(2) + ',' + y.toFixed(2)
      }).join(' ')
      return h('div', { className: 'cb-spark-wrap' },
        h('div', { className: 'cb-spark-scale' },
          h('span', null, format(max)),
          h('span', null, format((min + max) / 2)),
          h('span', null, format(min)),
        ),
        h('div', { className: 'cb-spark-plot' },
          values.length >= 2
            ? h('svg', { className: 'cb-spark ' + (props.className || ''), viewBox: '0 0 100 30', preserveAspectRatio: 'none' },
                h('polyline', { points: points }),
              )
            : h('div', { className: 'cb-spark-empty' }, '采样中'),
        ),
      )
    }

    function RingChart(props) {
      var percent = Number(props.percent)
      if (!Number.isFinite(percent)) percent = 0
      percent = Math.max(0, Math.min(100, percent))
      var radius = 15
      var circumference = 2 * Math.PI * radius
      return h('svg', { className: 'cb-ring', viewBox: '0 0 40 40' },
        h('circle', { className: 'cb-ring-bg', cx: 20, cy: 20, r: radius }),
        h('circle', {
          className: 'cb-ring-fg',
          cx: 20,
          cy: 20,
          r: radius,
          strokeDasharray: circumference.toFixed(2),
          strokeDashoffset: (circumference * (1 - percent / 100)).toFixed(2),
          transform: 'rotate(-90 20 20)',
        }),
        h('text', { className: 'cb-ring-text', x: 20, y: 21, textAnchor: 'middle', dominantBaseline: 'middle' }, Math.round(percent) + '%'),
      )
    }

    function ResourceTile(props) {
      if (props.ringPercent !== undefined) {
        var rows = props.ringRows || []
        return h('div', { className: 'cb-resource cb-resource-ring' },
          h('div', { className: 'cb-resource-label' }, props.label),
          h('div', { className: 'cb-ring-wrap' },
            h(RingChart, { percent: props.ringPercent }),
            h('div', { className: 'cb-ring-copy' },
              rows.length > 0
                ? rows.map(function (row, index) {
                    return h('div', { className: 'cb-ring-row', key: index },
                      h('span', { className: 'cb-ring-key' }, row.label),
                      h('span', { className: 'cb-ring-val' }, row.value),
                    )
                  })
                : h('div', null,
                    h('div', { className: 'cb-resource-value' }, props.value),
                    h('div', { className: 'cb-resource-sub' }, props.sub),
                  ),
            ),
          ),
        )
      }
      return h('div', { className: 'cb-resource' },
        h('div', { className: 'cb-resource-label' }, props.label),
        h('div', { className: 'cb-resource-value' }, props.value),
        h('div', { className: 'cb-resource-sub' }, props.sub),
        props.series ? h(Sparkline, {
          values: props.series,
          className: props.className,
          formatValue: props.formatValue,
          percent: props.percent,
        }) : null,
      )
    }

    function DimensionDialog(props) {
      var prompt = props.prompt
      if (!prompt) return null
      var isModel = prompt.kind === 'model' || prompt.kind === 'gguf'
      var current = Number(prompt.current)
      var native = Number(prompt.native)
      function dimensionEffect(target, modelDimensions) {
        if (!Number.isFinite(modelDimensions) || modelDimensions <= 0) {
          return '当前模型原生宽度未知（尚未成功探测），无法判断会截断还是补 0；建议先点「测试调用」看实际返回维度。'
        }
        if (target < modelDimensions) {
          return '当前模型原生输出为 ' + String(modelDimensions) + ' 维；目标更小，会截断向量：只保留前 ' + String(target) + ' 维，丢弃后 ' + String(modelDimensions - target) + ' 维。如果模型不是按 MRL 训练的，检索质量可能明显下降。'
        }
        if (target > modelDimensions) {
          return '当前模型原生输出为 ' + String(modelDimensions) + ' 维；目标更大，只会在末尾补 0（多出 ' + String(target - modelDimensions) + ' 维），不会增加语义信息，但存储和索引会更大。'
        }
        return '当前模型原生输出为 ' + String(modelDimensions) + ' 维，与目标维度一致，重嵌后使用完整输出。'
      }
      var body = isModel
        ? [
            h('p', { key: 'main' }, '模型原生输出为 ', h('strong', null, String(native) + ' 维'), '，当前 memory 向量维度为 ', h('strong', null, String(current) + ' 维'), '。'),
            h('p', { key: 'effect' }, dimensionEffect(current, native)),
            h('p', { key: 'keep' }, '保持当前维度：不会触发重嵌；新模型输出会按上面的规则适配到当前维度。'),
            h('p', { key: 'change' }, '改用模型维度：保存后触发 memory schema migration，对所有条目全面重嵌并重建索引。'),
          ]
        : [
            h('p', { key: 'main' }, '将向量维度从 ', h('strong', null, String(current) + ' 维'), ' 改为 ', h('strong', null, String(native) + ' 维'), '。'),
            h('p', { key: 'model' }, prompt.modelDimensions
              ? '当前模型原生输出：' + String(prompt.modelDimensions) + ' 维。'
              : '当前模型原生输出：未知（尚未成功探测，或模型列表里没有这个模型的维度信息）。'),
            h('p', { key: 'effect' }, dimensionEffect(native, prompt.modelDimensions)),
            h('p', { key: 'change' }, '保存后会触发 memory schema migration，对所有条目全面重嵌并重建索引；迁移完成前向量召回会降级。'),
          ]
      return h('div', { className: 'cb-modal-backdrop', role: 'presentation' },
        h('div', { className: 'cb-modal', role: 'dialog', 'aria-modal': 'true' },
          h('div', { className: 'cb-modal-title' }, isModel ? '切换 embedding 模型' : '修改向量维度'),
          h('div', { className: 'cb-modal-copy' }, body),
          h('div', { className: 'cb-modal-actions' },
            isModel ? h('button', { type: 'button', className: 'cb-btn', onClick: props.onKeep }, '保持 ' + String(current) + ' 维（补0/截断）') : null,
            h('button', { type: 'button', className: 'cb-btn primary', onClick: props.onChange }, isModel ? '改为 ' + String(native) + ' 维并重嵌' : '确认修改并重嵌'),
            h('button', { type: 'button', className: 'cb-btn ghost', onClick: props.onCancel }, '取消'),
          ),
        ),
      )
    }

    function embeddingMonitorInfo(monitor, mode) {
      var remote = mode === 'remote'
      if (!monitor) {
        return { tone: 'idle', label: '检测中', description: '正在读取 embedding 服务状态。' }
      }
      if (monitor.operation && monitor.operation.phase) {
        var starting = monitor.operation.phase === 'starting'
        return {
          tone: 'warn',
          label: starting ? '启动中' : '处理中',
          description: monitor.operation.message || (starting ? '正在启动 llama.cpp embedding 服务。' : 'embedding 服务正在处理中。'),
        }
      }
      if (remote) {
        if (!monitor.endpoint) return { tone: 'idle', label: '未配置', description: '尚未配置远端 embedding endpoint。' }
        return monitor.available
          ? { tone: 'ok', label: '可用', description: '远端 embedding endpoint 可访问：' + monitor.endpoint }
          : { tone: 'err', label: '不可用', description: '无法访问远端 embedding endpoint：' + monitor.endpoint }
      }
      if (monitor.running) {
        return { tone: 'ok', label: '运行中', description: 'llama-server 正在 ' + monitor.endpoint + ' 接受请求。' }
      }
      return { tone: 'warn', label: '已停止', description: 'llama-server 未运行；可在配置页启动。' }
    }

    function baseNameOf(filePath) {
      var parts = String(filePath || '').split(/[\\/]/)
      return parts[parts.length - 1] || '—'
    }

    function EmbeddingStatusPage(props) {
      var monitor = props.monitor
      var mode = (monitor && monitor.mode) || props.mode || 'remote'
      var isRemote = mode === 'remote'
      var llama = monitor && monitor.llama
      var resources = monitor && monitor.resources
      var usage = (monitor && monitor.usage) || { total: 0, success: 0, failure: 0, recent: [] }
      var info = embeddingMonitorInfo(monitor, mode)
      var gpu = resources && resources.gpu
      var ram = resources && resources.ram
      var cpu = resources && resources.cpu
      var installed = props.installed === true
      var llamaRunning = props.running !== undefined ? props.running : Boolean(monitor && monitor.running)
      var starting = Boolean(monitor && monitor.operation && monitor.operation.phase === 'starting')
      var historyState = useState([])
      var resourceHistory = historyState[0]
      var setResourceHistory = historyState[1]
      useEffect(function () {
        if (!monitor || !monitor.resources) return
        var sample = {
          cpu: monitor.resources.cpu ? monitor.resources.cpu.usagePercent : null,
          gpu: monitor.resources.gpu ? monitor.resources.gpu.utilPercent : null,
          ram: monitor.resources.ram ? monitor.resources.ram.usedBytes : null,
        }
        setResourceHistory(function (previous) {
          return previous.concat(sample).slice(-180)
        })
      }, [monitor])
      function seriesOf(key) {
        return resourceHistory.map(function (sample) { return sample[key] }).filter(function (value) { return typeof value === 'number' && Number.isFinite(value) })
      }
      var cpuHistory = seriesOf('cpu')
      var gpuHistory = seriesOf('gpu')
      var ramHistory = seriesOf('ram')
      var ramPercent = ram && ram.systemTotalBytes ? Math.round((ram.usedBytes / ram.systemTotalBytes) * 100) : null
      var buckets = usage.buckets || []
      var maxBucket = Math.max(1, ...buckets.map(function (bucket) { return bucket.total }))
      function hourLabel(value) {
        try { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch (error) { return '' }
      }
      var dimensions = props.dimensions || '—'
      function time(value) {
        if (!value) return '—'
        try { return new Date(value).toLocaleTimeString() } catch (error) { return String(value) }
      }
      function gpuText() {
        if (!gpu) return '—'
        return (gpu.usedMiB === null || gpu.usedMiB === undefined ? '—' : gpu.usedMiB + ' MiB') + ' / ' + (gpu.totalMiB === null || gpu.totalMiB === undefined ? '—' : gpu.totalMiB + ' MiB')
      }
      var actions = []
      if (!isRemote && installed) {
        if (starting) {
          actions.push(h('button', { key: 'starting', type: 'button', className: 'cb-btn primary', disabled: true }, '启动中…'))
        } else if (llamaRunning) {
          actions.push(h('button', { key: 'stop', type: 'button', className: 'cb-btn', disabled: props.actionBusy, onClick: props.onStop }, props.actionBusy ? '处理中…' : '停止'))
          actions.push(h('button', { key: 'restart', type: 'button', className: 'cb-btn', disabled: props.actionBusy, onClick: props.onStart }, props.actionBusy ? '处理中…' : '重启'))
        } else {
          actions.push(h('button', { key: 'start', type: 'button', className: 'cb-btn primary', disabled: props.actionBusy, onClick: props.onStart }, props.actionBusy ? '启动中…' : '启动'))
        }
      }
      actions.push(h('button', { key: 'probe', type: 'button', className: 'cb-btn primary', disabled: props.busy, onClick: props.onProbe }, props.busy ? '测试中…' : '测试调用'))
      actions.push(h('button', { key: 'refresh', type: 'button', className: 'cb-btn ghost', onClick: props.onRefresh }, '刷新'))
      return h('div', null,
        props.error ? h(Banner, { tone: 'error' }, props.error) : null,
        h(Card, {
          title: '服务状态',
          sub: isRemote ? '远端 embedding service' : 'llama.cpp 本地推理',
          right: h(Chip, null, isRemote ? 'remote' : 'llama.cpp'),
        },
          h('div', { className: 'cb-hero-head' },
            h(Dot, { tone: info.tone }),
            h('span', { className: 'cb-hero-state' }, info.label),
            h(Chip, { tone: info.tone === 'ok' ? 'ok' : info.tone === 'err' ? 'err' : info.tone === 'warn' ? 'warn' : null }, isRemote ? 'embedding' : (llama && llama.backend ? llama.backend : 'local')),
          ),
          h('div', { className: 'cb-hero-desc' }, info.description),
          h('div', { className: 'cb-metrics' },
            isRemote
              ? [
                  h(Metric, { key: 'endpoint', label: 'Endpoint', value: (monitor && monitor.remote && monitor.remote.baseUrl) || '—', hint: (monitor && monitor.remote && monitor.remote.path) || '' }),
                  h(Metric, { key: 'model', label: 'Model', value: (monitor && monitor.remote && monitor.remote.model) || '—', hint: '远端 embedding' }),
                  h(Metric, { key: 'available', label: '可用性', value: monitor ? (monitor.available ? 'available' : 'unavailable') : 'checking', hint: '最近检查 ' + time(monitor && monitor.checkedAt) }),
                  h(Metric, { key: 'calls', label: '调用量', value: String(usage.total), hint: '成功 ' + usage.success + ' / 失败 ' + usage.failure }),
                ]
              : [
                  h(Metric, { key: 'model', label: '模型', value: baseNameOf(llama && llama.model), hint: 'llama.cpp GGUF' }),
                  h(Metric, { key: 'backend', label: '后端', value: (llama && llama.backend) || '—', hint: (llama && llama.build) || 'llama.cpp' }),
                  h(Metric, { key: 'dimensions', label: '向量维度', value: String(dimensions), hint: 'embedding dimensions' }),
                  h(Metric, { key: 'calls', label: '调用量', value: String(usage.total), hint: '成功 ' + usage.success + ' / 失败 ' + usage.failure }),
                ],
          ),
          h('div', { className: 'cb-actions' }, actions),
        ),
        !isRemote
          ? h(Card, { title: '资源占用', sub: '实时采样 · 任务管理器风格', right: h(Chip, null, 'live') },
              h('div', { className: 'cb-resource-grid' },
                h(ResourceTile, {
                  label: 'CPU',
                  value: cpu && cpu.usagePercent !== null && cpu.usagePercent !== undefined ? Math.round(cpu.usagePercent) + '%' : '—',
                  sub: cpu ? String(cpu.cores) + ' cores' : '—',
                  series: cpuHistory,
                  className: 'cpu',
                  percent: true,
                }),
                h(ResourceTile, {
                  label: 'GPU',
                  value: gpu && gpu.utilPercent !== null && gpu.utilPercent !== undefined ? String(gpu.utilPercent) + '%' : '—',
                  sub: gpu ? 'VRAM ' + gpuText() : '—',
                  series: gpuHistory,
                  className: 'gpu',
                  percent: true,
                }),
                h(ResourceTile, {
                  label: '内存',
                  value: ramPercent !== null ? String(ramPercent) + '%' : '—',
                  sub: ram ? formatBytes(ram.usedBytes) + ' / ' + formatBytes(ram.systemTotalBytes) : '—',
                  series: ramHistory,
                  className: 'ram',
                  percent: false,
                  formatValue: formatBytes,
                }),
                h(ResourceTile, {
                  label: 'llama 显存',
                  ringPercent: gpu && gpu.totalMiB ? (gpu.llamaMiB / gpu.totalMiB) * 100 : 0,
                  ringRows: [
                    { label: '总 VRAM', value: gpu && gpu.totalMiB ? gpu.totalMiB + ' MiB' : '—' },
                    { label: '已用', value: gpu && gpu.usedMiB !== null && gpu.usedMiB !== undefined ? gpu.usedMiB + ' MiB' : '—' },
                    { label: 'llama', value: gpu && gpu.llamaMiB !== null && gpu.llamaMiB !== undefined ? gpu.llamaMiB + ' MiB' : '—' },
                    { label: '进程内存', value: ram && ram.llamaBytes ? formatBytes(ram.llamaBytes) : '—' },
                  ],
                }),
              ),
            )
          : null,
        h(Card, { title: '调用统计', sub: '最近 24 小时 · 明细 10 次', right: h(Chip, null, String(usage.total) + ' calls') },
          h('div', { className: 'cb-metrics' },
            h(Metric, { label: '总调用', value: String(usage.total) }),
            h(Metric, { label: '成功', value: String(usage.success) }),
            h(Metric, { label: '失败', value: String(usage.failure) }),
            h(Metric, { label: '最近耗时', value: usage.recent.length > 0 ? String(usage.recent[0].durationMs) + ' ms' : '—' }),
          ),
          buckets.length > 0
            ? h('div', null,
                h('div', { className: 'cb-section-label' }, '最近 24 小时调用分布'),
                h('div', { className: 'cb-bars' }, buckets.map(function (bucket, index) {
                  var height = bucket.total === 0 ? 0 : Math.max(2, Math.round((bucket.total / maxBucket) * 100))
                  return h('div', {
                    className: 'cb-bar',
                    key: index,
                    title: hourLabel(bucket.start) + ' · ' + bucket.total + ' calls（成功 ' + bucket.success + ' / 失败 ' + bucket.failure + '）',
                  }, h('div', {
                    className: 'cb-bar-fill' + (bucket.failure > 0 ? ' is-fail' : ''),
                    style: { height: height + '%' },
                  }))
                })),
                h('div', { className: 'cb-bar-labels' },
                  h('span', null, hourLabel(buckets[0].start)),
                  h('span', null, '现在'),
                ),
              )
            : null,
          usage.recent.length === 0
            ? h('div', { className: 'cb-empty' }, '暂无调用；检索链路接入后会自动累计，也可以点「测试调用」验证端点。')
            : h('div', null,
                h('div', { className: 'cb-section-label' }, '最近 10 次调用'),
                usage.recent.slice(0, 10).map(function (entry, index) {
                return h('div', { className: 'cb-list-row', key: index },
                  h('div', { className: 'cb-list-main', style: { display: 'block', minWidth: 0 } },
                    h('div', null,
                      h('span', { className: 'cb-code' }, entry.ok ? 'OK' : 'FAIL'),
                      ' ',
                      entry.mode + ' · ' + time(entry.at),
                    ),
                    h('div', { className: 'cb-card-sub wrap' },
                      (entry.inputs || 1) + ' inputs · ' + (entry.dimensions || '?') + ' dim · ' + entry.durationMs + ' ms · ' + (entry.error || entry.endpoint || '—'),
                    ),
                  ),
                  h('div', { className: 'cb-list-side' }, entry.ok ? 'success' : 'error'),
                )
              }),
            ),
          ),
        )
    }

    function EmbeddingPage() {
      var statusState = useState(null)
      var status = statusState[0]
      var setStatus = statusState[1]
      var configState = useState(null)
      var config = configState[0]
      var setConfig = configState[1]
      var devicesState = useState(null)
      var devices = devicesState[0]
      var setDevices = devicesState[1]
      var draftState = useState(null)
      var draft = draftState[0]
      var setDraft = draftState[1]
      var errorState = useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var noticeState = useState('')
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var savingState = useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]
      var actionBusyState = useState(false)
      var actionBusy = actionBusyState[0]
      var setActionBusy = actionBusyState[1]
      var backendState = useState('vulkan')
      var backend = backendState[0]
      var setBackend = backendState[1]
      var browseOpenState = useState(false)
      var browseOpen = browseOpenState[0]
      var setBrowseOpen = browseOpenState[1]
      var browseDataState = useState(null)
      var browseData = browseDataState[0]
      var setBrowseData = browseDataState[1]
      var browsePathState = useState('')
      var browsePath = browsePathState[0]
      var setBrowsePath = browsePathState[1]
      var tabState = useState('status')
      var tab = tabState[0]
      var setTab = tabState[1]
      var monitorState = useState(null)
      var monitor = monitorState[0]
      var setMonitor = monitorState[1]
      var probeBusyState = useState(false)
      var probeBusy = probeBusyState[0]
      var setProbeBusy = probeBusyState[1]
      var dimensionPromptState = useState(null)
      var dimensionPrompt = dimensionPromptState[0]
      var setDimensionPrompt = dimensionPromptState[1]
      var migrationBusyState = useState(false)
      var migrationBusy = migrationBusyState[0]
      var setMigrationBusy = migrationBusyState[1]

      var loadStatus = useCallback(function () {
        return embeddingRequest('/status')
          .then(function (value) { setStatus(value) })
          .catch(function (failure) { setError(failure.message) })
      }, [])

      var loadConfig = useCallback(function () {
        return configRequest('/config')
          .then(function (value) {
            setConfig(value)
            setDraft({ embedding: cloneJson(value.embedding), device: cloneJson(value.device) })
          })
          .catch(function (failure) { setError(failure.message) })
      }, [])

      var loadDevices = useCallback(function () {
        return configRequest('/config/devices')
          .then(function (value) { setDevices(value) })
          .catch(function (failure) { setError(failure.message) })
      }, [])

      var loadMonitor = useCallback(function () {
        return embeddingRequest('/monitor')
          .then(function (value) { setMonitor(value) })
          .catch(function () { setMonitor(null) })
      }, [])

      var pageReady = Boolean(status && config)

      useEffect(function () {
        loadStatus()
        loadConfig()
      }, [loadStatus, loadConfig])

      useEffect(function () {
        if (tab !== 'config' || devices) return
        loadDevices()
      }, [tab, devices, loadDevices])

      useEffect(function () {
        var timer = setInterval(loadStatus, 1500)
        return function () { clearInterval(timer) }
      }, [loadStatus])

      useEffect(function () {
        if (!pageReady) return
        loadMonitor()
        var timer = setInterval(loadMonitor, 2000)
        return function () { clearInterval(timer) }
      }, [pageReady, loadMonitor])

      useEffect(function () {
        if (!notice) return
        var timer = setTimeout(function () { setNotice('') }, 3500)
        return function () { clearTimeout(timer) }
      }, [notice])

      useEffect(function () {
        if (status && status.llama && status.llama.backend) setBackend(status.llama.backend)
      }, [status])

      useEffect(function () {
        if (!status || status.installed) return
        const recommended = (status.assets || []).find(function (asset) { return asset.recommended })
        if (recommended) {
          setBackend(recommended.backend)
          return
        }
        if (!devices || !devices.recommended) return
        setBackend(devices.recommended === 'cuda' ? 'cuda' : devices.recommended === 'vulkan' ? 'vulkan' : 'cpu')
      }, [devices, status && status.installed])

      function update(parts, value) {
        setDraft(function (previous) { return setJsonPath(previous, parts, value) })
      }

      function selectBackend(value) {
        setBackend(value)
        update(['embedding', 'llama', 'gpuLayers'], value === 'cpu' ? 0 : 999)
        update(['embedding', 'llama', 'backend'], value === 'cuda13' ? 'auto' : value)
      }

      function probeEmbedding() {
        setProbeBusy(true)
        setError('')
        setNotice('')
        embeddingRequest('/probe', { method: 'POST' })
          .then(function () { return loadMonitor() })
          .catch(function (failure) { setError(failure.message) })
          .finally(function () { setProbeBusy(false) })
      }

      function askDshForModel() {
        var gpuNames = devices && devices.gpus && devices.gpus.length > 0
          ? devices.gpus.map(function (gpu) { return gpu.name + (gpu.memory ? '（' + gpu.memory + '）' : '') }).join(', ')
          : '未检测到 GPU'
        var cpuText = devices && devices.cpu && devices.cpu.cores ? String(devices.cpu.cores) + ' 核' : '未知'
        var ramText = devices && devices.memoryBytes ? (devices.memoryBytes / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知'
        var cudaText = (status && status.deviceCudaVersion) || (devices && devices.cudaVersion) || '未知'
        var driverText = (devices && devices.driverVersion) || '未知'
        var modeText = draft.embedding.mode === 'remote' ? '远端 embedding service' : 'llama.cpp 本地推理'
        var modelName = baseNameOf(draft.embedding.llama.model) || '未选择'
        var runtimeText = status && status.installed && status.llama
          ? status.llama.build + ' / ' + status.llama.backend
          : '未安装'
        var runningText = status && status.running ? 'running' : 'stopped'
        var candidates = (status.models || []).map(function (model) {
          return model.name + '（' + model.params + ', ' + model.dimensions + 'd）'
        }).join('、') || '暂无'
        var prompt = [
          '请帮我为 dsh-claybot 的 Memory → 嵌入服务配置 llama.cpp 本地 embedding。先不要直接改配置或下载大模型，先调研并给方案。',
          '',
          '【当前设备】',
          'GPU：' + gpuNames,
          'CUDA：' + cudaText,
          '驱动：' + driverText,
          'CPU：' + cpuText,
          '内存：' + ramText,
          '',
          '【当前状态】',
          '模式：' + modeText,
          '维度：' + draft.embedding.dimensions,
          '当前模型：' + modelName,
          '运行时：' + runtimeText,
          '服务状态：' + runningText,
          '内置候选模型（仅作参考，绝不是可选项上限）：',
          candidates,
          '',
          '【任务】',
          '1. 先检查 dsh-claybot 的现有实现和配置，重点看：',
          '   - packages/memory/lib/embedding.js',
          '   - packages/memory/lib/config.js',
          '   - packages/memory/lib/gguf.js',
          '   - plans/plan.md',
          '   - plans/impl-embedding.md',
          '   以及当前 state（~/.dsh/claybot）和正在运行的 llama-server 状态。',
          '2. 不要只从上面内置列表里选。内置列表只是对照，不是限制。请主动联网搜索 Hugging Face、ModelScope、GitHub 等来源，寻找更适合本机显存和用途的 GGUF embedding 模型，包括不在内置列表里的新模型。中文、多语言、长上下文、代码等方向都请按实际情况评估。',
          '3. 对候选模型尽量核实：llama.cpp 是否兼容（architecture、pooling、context、embedding length、MRL）、参数量、向量维度、最大上下文、量化与文件大小、下载链接与 SHA-256、许可证，以及显存/内存占用估算。',
          '4. 结合当前存储/索引策略判断维度是否合适：n < 2000 用 vector(n) + 全维 vector HNSW；2000 ≤ n ≤ 4000 用 halfvec(n) + 全维 halfvec HNSW；n > 4000 存 halfvec(n)，只索引前 4000 维 halfvec + 全量 rerank，并且需要 MRL。如果候选维度需要截断或换模型，请说明影响。',
          '5. 给出 3 个左右候选的对比表，并明确推荐一个；说明它比内置列表里的模型强在哪里，或者说明内置列表已经够用。',
          '6. 最后给出可执行的安装/下载/配置步骤：目标目录、GGUF 路径、维度、context、pooling、是否需要重建索引、如何验证 embedding 维度和端点健康。任何大文件下载、配置修改或服务重启前都先向我确认。',
          '',
          '要求：优先使用官方模型卡/仓库和可验证来源；不要编造 SHA、下载链接或 llama.cpp 兼容性。先给调研结论和方案，等我确认后再动手。',
        ].join('\n')
        function copyPrompt() {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(prompt)
              .then(function () { setNotice('工作区服务不可用，已复制请求；粘贴到对话里发送即可') })
              .catch(function (failure) { setError('复制请求失败：' + (failure instanceof Error ? failure.message : String(failure))) })
          } else {
            setError('工作区服务不可用，且当前环境不支持剪贴板')
          }
        }
        var workspace = null
        try {
          if (clientCtx && typeof clientCtx.get === 'function') workspace = clientCtx.get('uiWorkspace')
        } catch (error) {
          workspace = null
        }
        if (!workspace || typeof workspace.startSession !== 'function') {
          copyPrompt()
          return
        }
        try {
          workspace.startSession(undefined, { prompt: prompt, whenDraftExists: 'append' })
          setNotice('已打开新对话并填入配置请求，发送后 AI 会继续')
        } catch (error) {
          copyPrompt()
        }
      }

      function modelNativeDimensions() {
        if (!draft) return null
        if (draft.embedding.mode === 'llama') {
          if (status && Number(status.modelDimensions) > 0) return Number(status.modelDimensions)
          var modelPath = draft.embedding.llama && draft.embedding.llama.model
          var catalogModel = (status && status.models || []).find(function (model) { return model.path === modelPath || model.relativePath === modelPath })
          if (catalogModel && Number(catalogModel.dimensions) > 0) return Number(catalogModel.dimensions)
        }
        if (monitor && monitor.lastEmbedding && Number(monitor.lastEmbedding.nativeDimensions) > 0) {
          return Number(monitor.lastEmbedding.nativeDimensions)
        }
        return null
      }

      function saveConfig(options) {
        options = options || {}
        var next = options.draft || draft
        var currentDimensions = Number(config.embedding.dimensions)
        var nextDimensions = Number(next.embedding.dimensions)
        if (!options.skipDimensionPrompt && nextDimensions !== currentDimensions) {
          setDimensionPrompt({
            kind: 'dimensions',
            current: currentDimensions,
            native: nextDimensions,
            modelDimensions: modelNativeDimensions(),
            mode: next.embedding.mode,
          })
          return Promise.resolve({ skipped: true })
        }
        setSaving(true)
        setError('')
        setNotice('')
        return configRequest('/config', {
          method: 'PUT',
          body: { embedding: next.embedding, device: next.device, database: { backupDir: config.database.backupDir } },
        })
          .then(function (value) {
            setConfig(value)
            setDraft({ embedding: cloneJson(value.embedding), device: cloneJson(value.device) })
            setNotice('配置已保存')
            return loadStatus()
          })
          .then(function () {
            if (options.migrate) return startMigration(next.embedding.mode)
            return null
          })
          .catch(function (failure) {
            setError(failure.message)
            throw failure
          })
          .finally(function () { setSaving(false) })
      }

      function startMigration(mode) {
        setMigrationBusy(true)
        var restart = mode === 'llama' && status && status.installed
          ? embeddingRequest('/action', { method: 'POST', body: { action: 'restart' } })
          : Promise.resolve(null)
        return restart
          .then(function () {
            return memoryRequest('/schema/migrations', { method: 'POST', body: { confirm: true } })
          })
          .then(function () {
            setNotice(mode === 'llama' ? '配置已保存，embedding 服务已按新模型重启，向量重嵌已开始' : '配置已保存，向量重嵌已开始')
            return loadStatus()
          })
          .catch(function (failure) {
            setError('配置已保存，但 migration 启动失败：' + failure.message)
            throw failure
          })
          .finally(function () { setMigrationBusy(false) })
      }

      function installRuntime() {
        const asset = (status.assets || []).find(function (item) { return item.backend === backend })
        if (asset && asset.installable === false) {
          setError('当前驱动 CUDA ' + (status.deviceCudaVersion || '未知') + ' 无法使用 ' + asset.label + '；请更新显卡驱动')
          return
        }
        setActionBusy(true)
        setError('')
        setNotice('')
        embeddingRequest('/install', { method: 'POST', body: { backend: backend, confirm: true } })
          .then(function () { setNotice('llama.cpp 安装已开始'); return loadStatus() })
          .catch(function (failure) { setError(failure.message) })
          .finally(function () { setActionBusy(false) })
      }

      function downloadModel(model) {
        setActionBusy(true)
        setError('')
        setNotice('')
        embeddingRequest('/models/download', { method: 'POST', body: { modelId: model.id, confirm: true } })
          .then(function () { setNotice('模型下载已开始'); return loadStatus() })
          .catch(function (failure) { setError(failure.message) })
          .finally(function () { setActionBusy(false) })
      }

      function applyModelDefaults(model, keepDimensions) {
        var next = cloneJson(draft)
        next.embedding.mode = 'llama'
        next.embedding.llama.model = model.relativePath || model.path
        if (!keepDimensions) next.embedding.dimensions = model.dimensions
        next.embedding.llama.pooling = model.pooling
        if (model.contextSize) next.embedding.llama.contextSize = model.contextSize
        setDraft(next)
        return next
      }

      function applyGgufDefaults(metadata, keepDimensions) {
        var next = cloneJson(draft)
        if (!keepDimensions && metadata.dimensions && metadata.dimensions >= 1 && metadata.dimensions <= 4096) {
          next.embedding.dimensions = metadata.dimensions
        }
        if (metadata.contextSize) next.embedding.llama.contextSize = metadata.contextSize
        if (metadata.pooling) next.embedding.llama.pooling = metadata.pooling
        setDraft(next)
        return next
      }

      function resolveDimensionPrompt(action) {
        var prompt = dimensionPrompt
        if (!prompt) return
        setDimensionPrompt(null)
        if (action === 'cancel') return
        if (prompt.kind === 'model') {
          if (action === 'keep') {
            applyModelDefaults(prompt.model, true)
            setNotice('已切换模型；保存后新向量会适配到 ' + String(prompt.current) + ' 维')
            return
          }
          var modelDraft = applyModelDefaults(prompt.model, false)
          saveConfig({ draft: modelDraft, skipDimensionPrompt: true, migrate: true }).catch(function () {})
          return
        }
        if (prompt.kind === 'gguf') {
          if (action === 'keep') {
            applyGgufDefaults(prompt.metadata, true)
            setNotice('已使用模型默认值；保存后新向量会适配到 ' + String(prompt.current) + ' 维')
            return
          }
          var ggufDraft = applyGgufDefaults(prompt.metadata, false)
          saveConfig({ draft: ggufDraft, skipDimensionPrompt: true, migrate: true }).catch(function () {})
          return
        }
        if (prompt.kind === 'dimensions' && action === 'change') {
          saveConfig({ skipDimensionPrompt: true, migrate: true }).catch(function () {})
        }
      }

      function inspectModelPath(filePath) {
        if (typeof filePath !== 'string' || !/\.gguf$/i.test(filePath)) return
        inspectGguf(filePath)
          .then(function (metadata) {
            var native = Number(metadata.dimensions)
            var current = Number(draft.embedding.dimensions)
            if (Number.isFinite(native) && native > 0 && native !== current) {
              setDimensionPrompt({ kind: 'gguf', metadata: metadata, native: native, current: current })
              return
            }
            applyGgufDefaults(metadata)
            setNotice('已读取 GGUF 元数据：' + (metadata.architecture || 'unknown') + ' · ' + (metadata.dimensions || '?') + 'd · ctx ' + (metadata.maxContext || metadata.contextSize || '?') + (metadata.pooling ? ' · ' + metadata.pooling : ''))
          })
          .catch(function () {
            setNotice('未能读取 GGUF 元数据，请在高级设置里手动确认维度/context')
          })
      }

      function useModel(model) {
        var native = Number(model.dimensions)
        var current = Number(draft.embedding.dimensions)
        if (Number.isFinite(native) && native > 0 && native !== current) {
          setDimensionPrompt({ kind: 'model', model: model, native: native, current: current })
          return
        }
        applyModelDefaults(model)
        setNotice('已选择 ' + model.name + '：维度 / context / pooling 已按模型默认值带出，保存后生效')
      }

      function startService() {
        setActionBusy(true)
        setError('')
        setNotice('')
        var action = status.running ? 'restart' : 'start'
        saveConfig()
          .then(function (result) {
            if (result && result.skipped) return null
            return embeddingRequest('/action', { method: 'POST', body: { action: action } })
          })
          .then(function (result) {
            if (result === null) return null
            return loadStatus()
          })
          .catch(function (failure) { setError(failure.message) })
          .finally(function () { setActionBusy(false) })
      }

      function stopService() {
        setActionBusy(true)
        setError('')
        setNotice('')
        embeddingRequest('/action', { method: 'POST', body: { action: 'stop' } })
          .then(function () { return loadStatus() })
          .catch(function (failure) { setError(failure.message) })
          .finally(function () { setActionBusy(false) })
      }

      function loadBrowse(target) {
        var path = target === undefined ? browsePath : target
        embeddingRequest('/browse?path=' + encodeURIComponent(path || ''))
          .then(function (value) {
            setBrowseData(value)
            setBrowsePath(value.path)
          })
          .catch(function (failure) { setError(failure.message) })
      }

      function openBrowse() {
        setBrowseOpen(true)
        var current = draft && draft.embedding && draft.embedding.llama ? draft.embedding.llama.model : ''
        loadBrowse(current || '')
      }

      function chooseModelFile(file) {
        update(['embedding', 'mode'], 'llama')
        update(['embedding', 'llama', 'model'], file.path)
        var matched = (status.models || []).find(function (model) { return model.path === file.path || model.file === file.name })
        inspectGguf(file.path)
          .then(function (metadata) {
            var native = Number(metadata.dimensions)
            var current = Number(draft.embedding.dimensions)
            if (Number.isFinite(native) && native > 0 && native !== current) {
              setDimensionPrompt({ kind: 'gguf', metadata: metadata, native: native, current: current })
              return
            }
            applyGgufDefaults(metadata)
            setNotice('已读取 GGUF 元数据：' + (metadata.architecture || 'unknown') + ' · ' + (metadata.dimensions || '?') + 'd · ctx ' + (metadata.maxContext || metadata.contextSize || '?') + (metadata.pooling ? ' · ' + metadata.pooling : ''))
          })
          .catch(function () {
            if (matched) {
              var native = Number(matched.dimensions)
              var current = Number(draft.embedding.dimensions)
              if (Number.isFinite(native) && native > 0 && native !== current) {
                setDimensionPrompt({
                  kind: 'gguf',
                  metadata: { dimensions: matched.dimensions, contextSize: matched.contextSize, pooling: matched.pooling },
                  native: native,
                  current: current,
                })
                return
              }
              update(['embedding', 'dimensions'], matched.dimensions)
              update(['embedding', 'llama', 'pooling'], matched.pooling)
              if (matched.contextSize) update(['embedding', 'llama', 'contextSize'], matched.contextSize)
              setNotice('已选择 ' + matched.name + '；未能读取文件头，已用推荐默认值')
            } else {
              setNotice('已选择本地模型：' + file.name + '；未能读取 GGUF 元数据，保持当前维度/context')
            }
          })
        setBrowseOpen(false)
      }

      if (!status || !config || !draft) {
        if (error) {
          return h(Card, { title: '嵌入服务', right: h(Chip, { tone: 'err' }, '不可用') },
            h('div', { className: 'cb-error' }, error),
            h('div', { className: 'cb-hero-desc', style: { marginTop: 6, marginBottom: 0 } }, '这通常表示 memory embedding service 未加载，或 API 路由不可用。请确认 dsh-claybot-memory 已启用，然后刷新页面。'),
          )
        }
        return h(Card, { title: '嵌入服务' }, h('div', { className: 'cb-empty' }, '加载中…'))
      }

      var embedding = draft.embedding
      var assets = status.assets || []
      var models = status.models || []
      var operation = status.operation
      var tabBar = h('div', { className: 'cb-seg cb-seg-mini' }, [
        ['status', '运行状态'],
        ['config', '配置'],
      ].map(function (item) {
        return h('button', {
          key: item[0],
          type: 'button',
          className: 'cb-seg-btn' + (tab === item[0] ? ' is-active' : ''),
          onClick: function () { setTab(item[0]) },
        }, item[1])
      }))
      if (tab === 'status') {
        return h('div', null,
          tabBar,
          h(EmbeddingStatusPage, {
            monitor: monitor,
            mode: embedding.mode,
            dimensions: embedding.dimensions,
            installed: status.installed,
            running: status.running,
            busy: probeBusy,
            actionBusy: actionBusy,
            onStart: startService,
            onStop: stopService,
            onProbe: probeEmbedding,
            onRefresh: loadMonitor,
            error: error,
          }),
          dimensionPrompt ? h(DimensionDialog, {
            prompt: dimensionPrompt,
            onKeep: function () { resolveDimensionPrompt('keep') },
            onChange: function () { resolveDimensionPrompt('change') },
            onCancel: function () { resolveDimensionPrompt('cancel') },
          }) : null,
        )
      }
      var remote = embedding.mode === 'remote'
      var usage = (monitor && monitor.usage) || { total: 0, success: 0, failure: 0, recent: [] }
      var info = embeddingMonitorInfo(monitor, embedding.mode)
      var statusCard = h(Card, {
        title: '服务状态',
        sub: remote ? '远端 embedding service' : 'llama.cpp 本地推理',
        right: h(Chip, null, remote ? 'remote' : 'llama.cpp'),
      },
        h('div', { className: 'cb-hero-head' },
          h(Dot, { tone: info.tone }),
          h('span', { className: 'cb-hero-state' }, info.label),
          h(Chip, { tone: info.tone === 'ok' ? 'ok' : info.tone === 'err' ? 'err' : info.tone === 'warn' ? 'warn' : null }, remote ? 'embedding' : (status.llama && status.llama.backend ? status.llama.backend : 'local')),
        ),
        h('div', { className: 'cb-hero-desc' }, info.description),
        h('div', { className: 'cb-metrics' },
          remote
            ? [
                h(Metric, { key: 'endpoint', label: 'Endpoint', value: embedding.remote.baseUrl || '—', hint: embedding.remote.path || '' }),
                h(Metric, { key: 'model', label: 'Model', value: embedding.remote.model || '—', hint: '远端 embedding' }),
                h(Metric, { key: 'dimensions', label: '向量维度', value: String(embedding.dimensions), hint: 'embedding dimensions' }),
                h(Metric, { key: 'calls', label: '调用量', value: String(usage.total), hint: '成功 ' + usage.success + ' / 失败 ' + usage.failure }),
              ]
            : [
                h(Metric, { key: 'model', label: '模型', value: baseNameOf(embedding.llama.model), hint: 'llama.cpp GGUF' }),
                h(Metric, { key: 'backend', label: '后端', value: (status.llama && status.llama.backend) || '—', hint: (status.llama && status.llama.build) || 'llama.cpp' }),
                h(Metric, { key: 'dimensions', label: '向量维度', value: String(embedding.dimensions), hint: 'embedding dimensions' }),
                h(Metric, { key: 'calls', label: '调用量', value: String(usage.total), hint: '成功 ' + usage.success + ' / 失败 ' + usage.failure }),
              ],
        ),
      )

      return h('div', null,
        tabBar,
        error ? h(Banner, { tone: 'error' }, error) : null,
        notice ? h(Banner, null, notice) : null,
        operation ? h(Card, { title: '进行中' }, h(OperationProgress, { operation: operation })) : null,
        status.lastError ? h(Banner, { tone: 'error' }, status.lastError) : null,
        statusCard,
        h('div', { className: 'cb-form-row', style: { marginBottom: 10 } },
          h('button', { type: 'button', className: 'cb-btn primary', disabled: saving, onClick: function () { saveConfig().catch(function () {}) } }, saving ? '保存中…' : '保存配置'),
          h('span', { className: 'cb-card-sub' }, 'memory sub-system 的 embedding 推理配置'),
        ),
        h(Card, { title: 'Embedding 方案', sub: 'embedding service 配置' },
          h(ConfigSelect, {
            label: '模式',
            value: embedding.mode,
            options: [['remote', '远端 embedding service'], ['llama', 'llama.cpp 本地推理']],
            onChange: function (value) { update(['embedding', 'mode'], value) },
          }),
          embedding.mode === 'remote'
            ? h('div', null,
                h(ConfigText, { label: 'Base URL', value: embedding.remote.baseUrl, placeholder: 'https://...', onChange: function (value) { update(['embedding', 'remote', 'baseUrl'], value) } }),
                h(ConfigText, { label: 'Model', value: embedding.remote.model, onChange: function (value) { update(['embedding', 'remote', 'model'], value) } }),
                h(ConfigText, { label: 'Embeddings path', value: embedding.remote.path, onChange: function (value) { update(['embedding', 'remote', 'path'], value) } }),
                h(ConfigText, { label: 'API Key', type: 'password', value: embedding.remote.apiKey, placeholder: embedding.remote.hasApiKey ? '已设置，留空保持不变' : '可留空', onChange: function (value) { update(['embedding', 'remote', 'apiKey'], value) } }),
                h(ConfigNumber, { label: 'Batch size', value: embedding.remote.batchSize, min: 1, max: 512, onChange: function (value) { update(['embedding', 'remote', 'batchSize'], value) } }),
              )
            : h('div', null,
                h('div', { className: 'cb-section-label' }, 'llama.cpp 运行时'),
                h('div', { className: 'cb-card-sub', style: { marginBottom: 4, whiteSpace: 'normal' } },
                  status.installed ? '已安装：' + status.llama.build + ' / ' + status.llama.backend : '尚未安装 llama.cpp 运行时',
                ),
                !status.installed
                  ? h('div', null,
                      h(ConfigSelect, {
                        label: '推理设备',
                        value: backend,
                        options: assets.map(function (asset) {
                          var note = asset.recommended ? ' · 推荐' : ''
                          if (asset.installable === false) note = ' · 需驱动 CUDA ≥' + asset.minCuda
                          return [asset.backend, asset.label + ' · ' + formatBytes(asset.size) + note]
                        }),
                        onChange: selectBackend,
                      }),
                      h('div', { className: 'cb-card-sub', style: { marginTop: 4, whiteSpace: 'normal' } },
                        '找不到目标版本？尝试更新你的显卡驱动。' + (status.deviceCudaVersion ? ' 当前 CUDA ' + status.deviceCudaVersion : ''),
                      ),
                      h('div', { className: 'cb-form-row' },
                        h('button', { type: 'button', className: 'cb-btn', disabled: actionBusy || operation !== null, onClick: installRuntime }, actionBusy ? '处理中…' : '安装 llama.cpp'),
                      ),
                    )
                  : null,
                h('div', { className: 'cb-card-sub', style: { marginTop: 4, whiteSpace: 'normal' } },
                  '选择 GPU 时会优先把模型放到显卡；CPU 模式只使用处理器。需要更细的参数控制时可展开高级设置。',
                ),
                h('label', { className: 'cb-checkbox', style: { marginTop: 8 } },
                  h('input', {
                    type: 'checkbox',
                    checked: embedding.llama.autoStart === true,
                    onChange: function (event) { update(['embedding', 'llama', 'autoStart'], event.target.checked) },
                  }),
                  '随插件自动启动 llama.cpp 本地推理',
                ),
                h('div', { className: 'cb-card-sub wrap', style: { marginTop: 6 } },
                  '启动 / 停止 / 重启服务请到「运行状态」页操作。',
                ),
                h('div', { className: 'cb-section-label' }, 'GGUF 模型'),
                h('div', { className: 'cb-form-row' },
                  h('input', {
                    className: 'cb-input',
                    value: embedding.llama.model,
                    spellCheck: false,
                    placeholder: '选择下方模型，或 browse 本地 .gguf 文件',
                    onChange: function (event) { update(['embedding', 'llama', 'model'], event.target.value) },
                    onBlur: function (event) { inspectModelPath(event.target.value) },
                  }),
                  h('button', { type: 'button', className: 'cb-btn', onClick: openBrowse }, 'Browse'),
                ),
                h('div', { className: 'cb-card-sub wrap', style: { marginTop: 4 } },
                  '选择或输入 GGUF 后会自动读取模型元信息（不加载模型）；读取失败时保持当前维度/context。',
                ),
                browseOpen
                  ? h('div', { className: 'cb-banner', style: { marginTop: 8 } },
                      h('div', { className: 'cb-form-row' },
                        h('input', {
                          className: 'cb-input',
                          value: browsePath,
                          spellCheck: false,
                          onChange: function (event) { setBrowsePath(event.target.value) },
                          onKeyDown: function (event) { if (event.key === 'Enter') loadBrowse(browsePath) },
                        }),
                        h('button', { type: 'button', className: 'cb-btn', onClick: function () { loadBrowse(browsePath) } }, '打开'),
                        browseData && browseData.parent
                          ? h('button', { type: 'button', className: 'cb-btn ghost', onClick: function () { loadBrowse(browseData.parent) } }, '上一级')
                          : null,
                        h('button', { type: 'button', className: 'cb-btn ghost', onClick: function () { setBrowseOpen(false) } }, '关闭'),
                      ),
                      browseData
                        ? h('div', { style: { marginTop: 6 } },
                            h('div', { className: 'cb-section-label' }, '目录'),
                            (browseData.dirs || []).map(function (dir) {
                              return h('div', { className: 'cb-list-row', key: dir.path },
                                h('div', { className: 'cb-list-main' },
                                  h('button', { type: 'button', className: 'cb-btn ghost', onClick: function () { loadBrowse(dir.path) } }, '📁 ' + dir.name),
                                ),
                              )
                            }),
                            h('div', { className: 'cb-section-label' }, 'GGUF 文件'),
                            (browseData.files || []).length === 0
                              ? h('div', { className: 'cb-empty' }, '当前目录没有 .gguf')
                              : (browseData.files || []).map(function (file) {
                                  return h('div', { className: 'cb-list-row', key: file.path },
                                    h('div', { className: 'cb-list-main' },
                                      h('button', { type: 'button', className: 'cb-btn ghost', onClick: function () { chooseModelFile(file) } }, file.name),
                                      h('span', { className: 'cb-card-sub' }, formatBytes(file.size)),
                                    ),
                                  )
                                }),
                          )
                        : h('div', { className: 'cb-empty' }, '加载目录…'),
                    )
                  : null,
                h('div', { className: 'cb-section-label' }, '推荐模型（按显存/内存选择）'),
                h('div', { className: 'cb-card-sub', style: { marginBottom: 4, whiteSpace: 'normal' } },
                  '从推荐列表，或 Browse 到同名 GGUF 选择会自动带出维度、context、pooling；其他自定义 GGUF 保持当前值。',
                ),
                h('div', { className: 'cb-banner', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                  h('button', { type: 'button', className: 'cb-btn primary', onClick: askDshForModel }, '让 AI 帮我配置 llama.cpp'),
                  h('span', { className: 'cb-card-sub wrap', style: { flex: '1 1 180px' } }, '打开新对话并填入请求，发送后 AI 接手；会带上当前设备与候选模型'),
                ),
                models.map(function (model) {
                  var selectedPath = model.relativePath || model.path
        var selected = embedding.llama.model === selectedPath || embedding.llama.model === model.path
                  var sizeLabel = model.size < 300 * 1024 * 1024 ? '轻量' : model.size < 800 * 1024 * 1024 ? '中量' : '重量'
                  return h('div', { className: 'cb-list-row', key: model.id },
                    h('div', { className: 'cb-list-main', style: { display: 'block' } },
                      h('div', null,
                        h('span', { className: 'cb-code' }, model.name),
                        ' ',
                        h(Chip, { tone: selected ? 'ok' : null }, selected ? '已选择' : sizeLabel),
                      ),
                      h('div', { className: 'cb-card-sub wrap' },
                        model.params + ' · ' + model.dimensions + ' dim · ctx ' + (model.contextSize || '?') + (model.maxContext && model.maxContext !== model.contextSize ? '/' + model.maxContext : '') + ' · ' + formatBytes(model.size) + ' · ' + model.note,
                      ),
                    ),
                    h('div', { className: 'cb-list-side' },
                      !model.downloaded
                        ? h('button', { type: 'button', className: 'cb-btn', disabled: actionBusy || operation !== null, onClick: function () { downloadModel(model) } }, '下载')
                        : h('button', { type: 'button', className: 'cb-btn', disabled: actionBusy, onClick: function () { useModel(model) } }, '使用'),
                    ),
                  )
                }),
              ),
          h('details', { style: { marginTop: 8 } },
            h('summary', { style: { cursor: 'pointer', fontSize: 12, opacity: 0.8 } }, '高级设置'),
            h('div', { style: { marginTop: 6 } },
              h(ConfigNumber, { label: '向量维度 dimensions', value: embedding.dimensions, min: 1, max: 4096, hint: '从模型列表选择会自动带出；2000 起存 halfvec，4000 以上只索引前 4000 维', onChange: function (value) { update(['embedding', 'dimensions'], value) } }),
              h('div', { className: 'cb-card-sub wrap' },
                '存储策略：' + embeddingStorageStrategy(embedding.dimensions),
              ),
              h('div', { className: 'cb-card-sub wrap', style: { marginTop: 2 } },
                '索引策略：' + embeddingIndexStrategy(embedding.dimensions),
              ),
              embedding.mode === 'llama'
                ? h('div', null,
                    h(ConfigNumber, { label: 'GPU layers', value: embedding.llama.gpuLayers, min: 0, max: 999, hint: 'GPU 默认尽量全部放到显卡；CPU 运行时忽略此值', onChange: function (value) { update(['embedding', 'llama', 'gpuLayers'], value) } }),
                    h(ConfigSelect, { label: 'Pooling', value: embedding.llama.pooling, options: ['mean', 'cls', 'last'], onChange: function (value) { update(['embedding', 'llama', 'pooling'], value) } }),
                    h('div', { className: 'cb-field-grid' },
                      h(ConfigNumber, { label: 'Context', value: embedding.llama.contextSize, min: 128, max: 1048576, hint: '从模型列表选择会自动带出', onChange: function (value) { update(['embedding', 'llama', 'contextSize'], value) } }),
                      h(ConfigNumber, { label: '端口', value: embedding.llama.port, min: 1, max: 65535, onChange: function (value) { update(['embedding', 'llama', 'port'], value) } }),
                    ),
                  )
                : null,
            ),
          ),
        ),
        h(Card, {
          title: '设备',
          sub: devices && devices.recommended ? '推荐 ' + devices.recommended : '检测中',
          right: h('button', { type: 'button', className: 'cb-btn ghost', onClick: function () { loadDevices().then(function () { setNotice('设备信息已刷新') }) } }, '刷新'),
        },
          devices
            ? h('div', null,
                h(KV, { label: 'CPU' }, devices.cpu.model + ' · ' + devices.cpu.cores + ' cores'),
                devices.gpus && devices.gpus.length > 0
                  ? devices.gpus.map(function (gpu, index) {
                      return h(KV, { key: 'gpu-' + index, label: 'GPU ' + (index + 1) }, gpu.name + (gpu.memory ? ' · ' + gpu.memory : ''))
                    })
                  : h('div', { className: 'cb-empty' }, '未检测到 GPU'),
                h(KV, { label: '可用后端' }, (devices.backends || []).join(', ')),
                h(KV, { label: 'CUDA' }, devices.cudaVersion || '—'),
                h(KV, { label: '驱动' }, devices.driverVersion || '—'),
              )
            : h('div', { className: 'cb-empty' }, '设备检测中…'),
        ),
        dimensionPrompt ? h(DimensionDialog, {
          prompt: dimensionPrompt,
          onKeep: function () { resolveDimensionPrompt('keep') },
          onChange: function () { resolveDimensionPrompt('change') },
          onCancel: function () { resolveDimensionPrompt('cancel') },
        }) : null,
      )
    }

    function ConfigSheetPage() {
      var includeSecretsState = useState(false)
      var includeSecrets = includeSecretsState[0]
      var setIncludeSecrets = includeSecretsState[1]
      var importTextState = useState('')
      var importText = importTextState[0]
      var setImportText = importTextState[1]
      var previewState = useState(null)
      var preview = previewState[0]
      var setPreview = previewState[1]
      var errorState = useState('')
      var error = errorState[0]
      var setError = errorState[1]
      var noticeState = useState('')
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var exportingState = useState(false)
      var exporting = exportingState[0]
      var setExporting = exportingState[1]
      var previewingState = useState(false)
      var previewing = previewingState[0]
      var setPreviewing = previewingState[1]
      var applyingState = useState(false)
      var applying = applyingState[0]
      var setApplying = applyingState[1]

      function exportConfig() {
        setExporting(true)
        setError('')
        setNotice('')
        configRequest('/config/export?secrets=' + (includeSecrets ? '1' : '0'))
          .then(function (value) {
            downloadJson('claybot-config-' + Date.now() + '.json', value)
            setNotice(includeSecrets ? '配置单已导出（含明文密钥）' : '配置单已导出（密钥已脱敏）')
          })
          .catch(function (failure) { setError(failure.message) })
          .then(function () { setExporting(false) })
      }

      function readImportFile(event) {
        var file = event.target.files && event.target.files[0]
        if (!file) return
        file.text()
          .then(function (text) {
            setImportText(text)
            setPreview(null)
            setNotice('已读取配置单，请预览导入')
          })
          .catch(function (failure) { setError(failure.message) })
        event.target.value = ''
      }

      function parseImportText() {
        try {
          return JSON.parse(importText)
        } catch (failure) {
          throw new Error('配置单 JSON 无效：' + (failure instanceof Error ? failure.message : String(failure)))
        }
      }

      function previewImport() {
        setPreviewing(true)
        setError('')
        setNotice('')
        try {
          var sheet = parseImportText()
          configRequest('/config/import', { method: 'POST', body: { sheet: sheet, apply: false } })
            .then(function (value) {
              setPreview(value)
              setNotice(value.changes.length === 0 ? '配置无变化' : '预览完成，确认后应用')
            })
            .catch(function (failure) { setError(failure.message) })
            .then(function () { setPreviewing(false) })
        } catch (failure) {
          setError(failure.message)
          setPreviewing(false)
        }
      }

      function applyImport() {
        setApplying(true)
        setError('')
        setNotice('')
        try {
          var sheet = parseImportText()
          configRequest('/config/import', { method: 'POST', body: { sheet: sheet, apply: true } })
            .then(function (value) {
              setPreview(value)
              setNotice('配置已导入')
            })
            .catch(function (failure) { setError(failure.message) })
            .then(function () { setApplying(false) })
        } catch (failure) {
          setError(failure.message)
          setApplying(false)
        }
      }

      return h('div', null,
        error ? h(Banner, { tone: 'error' }, error) : null,
        notice ? h(Banner, null, notice) : null,
        h(Card, { title: '配置单', sub: 'memory subsystem 基础设施 · JSON' },
          h('div', { className: 'cb-card-sub', style: { marginBottom: 8, whiteSpace: 'normal' } },
            '只包含 memory 基础设施：数据库版本/备份目录、embedding、设备偏好；不含 agent LLM 配置。',
          ),
          h('label', { className: 'cb-checkbox' },
            h('input', { type: 'checkbox', checked: includeSecrets, onChange: function (event) { setIncludeSecrets(event.target.checked) } }),
            '导出时包含明文 API Key',
          ),
          h('div', { className: 'cb-form-row' },
            h('button', { type: 'button', className: 'cb-btn', disabled: exporting, onClick: exportConfig }, exporting ? '导出中…' : '导出配置单'),
            h('input', { className: 'cb-file', type: 'file', accept: '.json,application/json', onChange: readImportFile }),
          ),
          h('div', { className: 'cb-card-sub', style: { marginTop: 6, whiteSpace: 'normal' } },
            '默认导出会脱敏 API Key；导入时留空的 Key 保持现有值；数据库版本不匹配只提示，不自动升级。',
          ),
          h('textarea', {
            className: 'cb-textarea',
            style: { minHeight: 120, marginTop: 8 },
            spellCheck: false,
            placeholder: '粘贴配置单 JSON，或选择文件…',
            value: importText,
            onChange: function (event) { setImportText(event.target.value); setPreview(null) },
          }),
          h('div', { className: 'cb-form-row' },
            h('button', { type: 'button', className: 'cb-btn', disabled: previewing, onClick: previewImport }, previewing ? '预览中…' : '预览导入'),
            h('button', { type: 'button', className: 'cb-btn primary', disabled: applying || preview === null, onClick: applyImport }, applying ? '应用中…' : '应用导入'),
          ),
          preview
            ? h('div', null,
                h('div', { className: 'cb-section-label' }, '变更'),
                preview.changes.length === 0
                  ? h('div', { className: 'cb-empty' }, '无变化')
                  : preview.changes.map(function (change) {
                      return h('div', { className: 'cb-list-row', key: change.path },
                        h('div', { className: 'cb-list-main' },
                          h('span', { className: 'cb-code' }, change.path),
                          h('span', { className: 'cb-card-sub' }, String(change.from) + ' → ' + String(change.to)),
                        ),
                      )
                    }),
                preview.warnings && preview.warnings.length > 0
                  ? h('div', { style: { marginTop: 8 } },
                      h('div', { className: 'cb-section-label' }, '提示'),
                      preview.warnings.map(function (warning, index) {
                        return h('div', { className: 'cb-card-sub', key: index, style: { whiteSpace: 'normal' } }, warning)
                      }),
                    )
                  : null,
              )
            : null,
        ),
      )
    }

    function ComponentsPage() {
      var dataState = useState(null)
      var data = dataState[0]
      var setData = dataState[1]
      var loadErrorState = useState('')
      var loadError = loadErrorState[0]
      var setLoadError = loadErrorState[1]
      var actionErrorState = useState('')
      var actionError = actionErrorState[0]
      var setActionError = actionErrorState[1]
      var noticeState = useState('')
      var notice = noticeState[0]
      var setNotice = noticeState[1]
      var dirState = useState('')
      var dir = dirState[0]
      var setDir = dirState[1]
      var checkingState = useState(false)
      var checking = checkingState[0]
      var setChecking = checkingState[1]
      var savingState = useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]
      var backingUpState = useState(false)
      var backingUp = backingUpState[0]
      var setBackingUp = backingUpState[1]
      var autoCheckedState = useState(false)
      var autoChecked = autoCheckedState[0]
      var setAutoChecked = autoCheckedState[1]

      var load = useCallback(function () {
        return request('/components')
          .then(function (value) {
            setData(value)
            setDir(function (previous) { return previous || value.backupDir || '' })
            setLoadError('')
          })
          .catch(function (failure) { setLoadError(failure.message) })
      }, [])

      useEffect(function () {
        load()
      }, [load])

      useEffect(function () {
        if (!data || autoChecked) return
        setAutoChecked(true)
        checkUpdates(true)
      }, [data, autoChecked])

      function checkUpdates(silent) {
        setChecking(true)
        if (!silent) {
          setActionError('')
          setNotice('')
        }
        request('/components/check', { method: 'POST' })
          .then(function () {
            if (!silent) setNotice('版本检查完成')
            return load()
          })
          .catch(function (failure) { setActionError(failure.message) })
          .then(function () { setChecking(false) })
      }

      function saveBackupDir() {
        setSaving(true)
        setActionError('')
        setNotice('')
        request('/backups/settings', { method: 'PUT', body: { dir: dir } })
          .then(function (value) {
            setDir(value.backupDir)
            setNotice('备份目录已保存')
            return load()
          })
          .catch(function (failure) { setActionError(failure.message) })
          .then(function () { setSaving(false) })
      }

      function backupNow() {
        setBackingUp(true)
        setActionError('')
        setNotice('')
        request('/backups', { method: 'POST', body: { confirm: true } })
          .then(function (value) {
            setNotice('备份完成：' + value.file + '（' + formatBytes(value.size) + '）')
            return load()
          })
          .catch(function (failure) { setActionError(failure.message) })
          .then(function () { setBackingUp(false) })
      }

      if (!data && loadError) {
        return h(Card, { title: '组件与备份', right: h(Chip, { tone: 'err' }, '不可用') }, h('div', { className: 'cb-error' }, loadError))
      }
      if (!data) {
        return h(Card, { title: '组件与备份' }, h('div', { className: 'cb-empty' }, '加载中…'))
      }

      var components = data.components || []
      var backups = data.backups || []
      var componentRows = components.map(function (component) {
        var statusChip = component.error
          ? h(Chip, { tone: 'err' }, '检查失败')
          : component.updateAvailable
            ? h(Chip, { tone: 'warn' }, '可更新')
            : h(Chip, { tone: 'ok' }, '已是最新')
        return h(
          'div',
          { className: 'cb-list-row', key: component.id },
          h('div', { className: 'cb-list-main' },
            h(Dot, { tone: component.updateAvailable ? 'warn' : 'ok' }),
            h('span', { className: 'cb-code' }, component.name),
            h('span', { className: 'cb-card-sub' },
              '已安装 ' + (component.installedVersion || '—') + ' · 最新 ' + (component.latestVersion || '未检查'),
            ),
          ),
          h('div', { className: 'cb-list-side' }, statusChip),
        )
      })

      var backupRows = backups.length === 0
        ? [h('div', { className: 'cb-empty', key: 'empty' }, '还没有备份。')]
        : backups.map(function (item) {
            return h(
              'div',
              { className: 'cb-list-row', key: item.path },
              h('div', { className: 'cb-list-main' },
                h(Dot, { tone: 'ok' }),
                h('span', { className: 'cb-code' }, item.name),
              ),
              h('div', { className: 'cb-list-side' }, formatBytes(item.size) + ' · ' + new Date(item.modifiedAt).toLocaleString()),
            )
          })

      return h('div', null,
        actionError ? h(Banner, { tone: 'error' }, actionError) : null,
        notice ? h(Banner, null, notice) : null,
        h(Card, {
          title: '组件',
          sub: '自动检查版本；更新需手动，不会自动 upgrade',
          right: h('button', { type: 'button', className: 'cb-btn', disabled: checking, onClick: function () { checkUpdates(false) } }, checking ? '检查中…' : '检查更新'),
        }, componentRows),
        h(Card, {
          title: '备份',
          sub: data.running ? null : '数据库未运行',
          right: h('button', { type: 'button', className: 'cb-btn primary', disabled: backingUp || !data.running, onClick: backupNow }, backingUp ? '备份中…' : '立即备份'),
        },
          h('div', { className: 'cb-form-row' },
            h('input', {
              className: 'cb-input',
              value: dir,
              spellCheck: false,
              placeholder: '备份目录（绝对路径）',
              onChange: function (event) { setDir(event.target.value) },
            }),
            h('button', { type: 'button', className: 'cb-btn', disabled: saving, onClick: saveBackupDir }, saving ? '保存中…' : '保存目录'),
          ),
          h('div', { className: 'cb-card-sub', style: { marginTop: 6, whiteSpace: 'normal' } },
            '备份目录可自定义；只有手动点击「立即备份」才会执行，不会自动备份。',
          ),
          h('div', { className: 'cb-section-label' }, '备份文件'),
          backupRows,
        ),
      )
    }

    function DatabasePage() {
      var statusState = useStatus()
      var status = statusState.status
      var statusError = statusState.error
      var reload = statusState.reload
      var pageState = useState('overview')
      var page = pageState[0]
      var setPage = pageState[1]
      var installState = useState(false)
      var showInstall = installState[0]
      var setShowInstall = installState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var actionErrorState = useState('')
      var actionError = actionErrorState[0]
      var setActionError = actionErrorState[1]
      var connectionState = useState(null)
      var connection = connectionState[0]
      var setConnection = connectionState[1]
      var passwordState = useState('')
      var password = passwordState[0]
      var setPassword = passwordState[1]
      var dbinfoState = useState(null)
      var dbinfo = dbinfoState[0]
      var setDbinfo = dbinfoState[1]
      var dbinfoErrorState = useState('')
      var dbinfoError = dbinfoErrorState[0]
      var setDbinfoError = dbinfoErrorState[1]

      var loadConnection = useCallback(function () {
        return request('/connection?role=admin')
          .then(function (value) {
            setConnection(value.connection)
            setPassword('')
          })
          .catch(function (failure) { setActionError(failure.message) })
      }, [])

      var loadDbinfo = useCallback(function () {
        return request('/catalog')
          .then(function (value) {
            setDbinfo(value)
            setDbinfoError('')
          })
          .catch(function (failure) { setDbinfoError(failure.message) })
      }, [])

      var installed = status && status.installed
      var running = status && status.running
      var connectionsState = useConnections(running)
      useEffect(function () {
        if (installed && running) {
          loadConnection()
          loadDbinfo()
        }
      }, [installed, running, loadConnection, loadDbinfo])

      function doAction(action) {
        setBusy(true)
        setActionError('')
        request('/action', { method: 'POST', body: { action: action } })
          .then(function () { return reload() })
          .catch(function (failure) { setActionError(failure.message) })
          .then(function () { setBusy(false) })
      }

      function startInstall() {
        setBusy(true)
        setActionError('')
        request('/install', { method: 'POST', body: { confirm: true } })
          .then(function () { setShowInstall(false); return reload() })
          .catch(function (failure) { setActionError(failure.message) })
          .then(function () { setBusy(false) })
      }

      function revealPassword() {
        request('/reveal', { method: 'POST', body: { role: 'admin' } })
          .then(function (value) { setPassword(value.password) })
          .catch(function (failure) { setActionError(failure.message) })
      }

      if (!status && statusError) {
        return h(Card, { title: '数据库服务', right: h(Chip, { tone: 'err' }, '不可用') },
          h('div', { className: 'cb-error' }, statusError),
          h('div', { className: 'cb-hero-desc', style: { marginTop: 6, marginBottom: 0 } }, '这通常表示 memory DB service 未安装或未启用。请先在插件管理中安装 dsh-claybot-memory。'),
        )
      }
      if (!status) {
        return h(Card, { title: '数据库服务' }, h('div', { className: 'cb-empty' }, '加载中…'))
      }

      var dbTabs = [
        ['overview', '概览'],
        ['connections', '连接'],
        ['sql', 'SQL Prompt'],
        ['components', '组件'],
      ]
      var overview = []
      overview.push(h(StatusHero, {
        key: 'status',
        status: status,
        busy: busy,
        onInstall: function () { setShowInstall(true) },
        onAction: doAction,
        onRefresh: reload,
      }))
      if (showInstall && !status.installed && !status.operation) {
        overview.push(h(InstallPanel, {
          key: 'install',
          catalog: status.catalog,
          busy: busy,
          onConfirm: startInstall,
          onCancel: function () { setShowInstall(false) },
        }))
      }
      if (status.installed) {
        overview.push(h(RolesCard, {
          key: 'roles',
          status: status,
          dbinfo: dbinfo,
          connections: connectionsState.data,
          error: dbinfoError,
          onRefresh: loadDbinfo,
        }))
      }
      overview.push(h(ConnectionSummary, {
        key: 'connections',
        status: status,
        data: connectionsState.data,
        error: connectionsState.error,
        onOpen: function () { setPage('connections') },
      }))

      var connectionsPage = []
      if (status.installed) {
        connectionsPage.push(h(ConnectionCard, {
          key: 'admin',
          status: status,
          connection: connection,
          password: password,
          onLoad: loadConnection,
          onReveal: revealPassword,
          onHide: function () { setPassword('') },
        }))
        connectionsPage.push(h(ConnectionsCard, {
          key: 'list',
          status: status,
          data: connectionsState.data,
          error: connectionsState.error,
          onRefresh: connectionsState.reload,
        }))
      } else {
        connectionsPage.push(h(Card, { key: 'empty', title: '连接' }, h('div', { className: 'cb-empty' }, '安装并启动后显示连接信息。')))
      }

      return h('div', null,
        h('div', { className: 'cb-seg cb-seg-mini' }, dbTabs.map(function (item) {
          return h('button', {
            key: item[0],
            type: 'button',
            className: 'cb-seg-btn' + (page === item[0] ? ' is-active' : ''),
            onClick: function () { setPage(item[0]) },
          }, item[1])
        })),
        actionError ? h(Banner, { tone: 'error' }, actionError) : null,
        page === 'overview' ? h('div', null, overview) : null,
        page === 'connections' ? h('div', null, connectionsPage) : null,
        page === 'sql' ? h(SqlPanel, { status: status }) : null,
        page === 'components' ? h(ComponentsPage) : null,
      )
    }

    function Placeholder(props) {
      return h(Card, { title: props.title }, h('div', { className: 'cb-empty' }, props.description || '待接入'))
    }

    function MemoryPage() {
      var tabState = useState('database')
      var tab = tabState[0]
      var setTab = tabState[1]
      var tabs = [
        ['overview', '概览'],
        ['database', '数据库'],
        ['embedding', '嵌入服务'],
        ['spaces', '记忆空间'],
        ['maintenance', '维护'],
        ['config', '配置'],
      ]
      return h('div', null,
        h('div', { className: 'cb-tabs' }, tabs.map(function (item) {
          return h('button', {
            key: item[0],
            type: 'button',
            className: 'cb-tab' + (tab === item[0] ? ' is-active' : ''),
            onClick: function () { setTab(item[0]) },
          }, item[1])
        })),
        tab === 'overview' ? h(Placeholder, { title: '记忆概览', description: '记忆条目、召回与维护状态（M2）' }) : null,
        tab === 'database' ? h(DatabasePage) : null,
        tab === 'embedding' ? h(EmbeddingPage) : null,
        tab === 'spaces' ? h(Placeholder, { title: '记忆空间', description: '记忆空间与条目浏览（M2）' }) : null,
        tab === 'maintenance' ? h(Placeholder, { title: '维护', description: '衰减、重嵌、人格维护（M2）' }) : null,
        tab === 'config' ? h(ConfigSheetPage) : null,
      )
    }

    function Console() {
      var tabState = useState('memory')
      var tab = tabState[0]
      var setTab = tabState[1]
      var tabs = [
        ['memory', '记忆'],
        ['providers', 'Providers'],
        ['tools', '工具与角色'],
        ['status', '运行状态'],
      ]
      return h('div', { className: 'cb-root' },
        h('style', null, CSS),
        h('div', { className: 'cb-header' },
          h('div', null,
            h('h2', { className: 'cb-title' }, 'ClayBot'),
            h('div', { className: 'cb-subtitle' }, 'memory subsystem · official PostgreSQL'),
          ),
        ),
        h('div', { className: 'cb-seg' }, tabs.map(function (item) {
          return h('button', {
            key: item[0],
            type: 'button',
            className: 'cb-seg-btn' + (tab === item[0] ? ' is-active' : ''),
            onClick: function () { setTab(item[0]) },
          }, item[1])
        })),
        tab === 'memory' ? h(MemoryPage) : null,
        tab === 'providers' ? h(Placeholder, { title: 'Providers', description: 'IO provider 状态与可选存储（M3）' }) : null,
        tab === 'tools' ? h(Placeholder, { title: '工具与角色', description: '角色 → 工具授权（后续）' }) : null,
        tab === 'status' ? h(Placeholder, { title: '运行状态', description: '引擎、Effects、Outbox（后续）' }) : null,
      )
    }

    function apply(ctx) {
      clientCtx = ctx
      ctx.effect(function () {
        var disposeTab = ctx.sidebarRightTabs.register({
          id: 'dsh-claybot',
          kind: 'dsh-claybot-console',
          priority: 'extension',
          keepMounted: true,
          title: function () { return 'ClayBot' },
          guide: [
            {
              id: 'dsh-claybot',
              order: 20,
              title: function () { return 'ClayBot' },
              description: function () { return 'ClayBot 控制台' },
            },
          ],
        })
        var disposeBody = ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-claybot' }, Console)
        return function () {
          try { disposeBody() } catch (error) {}
          try { disposeTab() } catch (error) {}
        }
      }, 'dsh-claybot: console')
    }

    module.exports = { name: 'dsh-claybot', inject: ['slots', 'sidebarRightTabs'], apply: apply }
    return module.exports
  },
})
