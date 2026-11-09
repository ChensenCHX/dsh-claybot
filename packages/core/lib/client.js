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

    var API = '/api/claybot/db'
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
      '.cb-sql-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}',
      '.cb-check{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary,#9a9a9a);font-size:11px}',
      '.cb-result{margin-top:8px}',
      '.cb-result-head{display:flex;gap:8px;align-items:center;color:var(--dsw-alias-label-tertiary,#8b8b8b);font-size:10px;letter-spacing:.03em;text-transform:uppercase}',
      '.cb-root button:focus{outline:none}',
      '.cb-root button:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#3b82f6));outline-offset:2px}',
      '.cb-root select:focus,.cb-root textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6)}',
    ].join('\n')

    function request(path, options) {
      var opts = Object.assign({}, options || {})
      opts.credentials = 'same-origin'
      opts.headers = Object.assign({}, opts.headers || {})
      if (opts.body !== undefined && typeof opts.body !== 'string') {
        opts.body = JSON.stringify(opts.body)
        if (!opts.headers['content-type']) opts.headers['content-type'] = 'application/json'
      }
      return fetch(API + path, opts).then(function (response) {
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
        ['spaces', '记忆空间'],
        ['maintenance', '维护'],
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
        tab === 'database' ? h(DatabasePage) : null,
        tab === 'overview' ? h(Placeholder, { title: '记忆概览', description: '记忆条目、召回与维护状态（M2）' }) : null,
        tab === 'spaces' ? h(Placeholder, { title: '记忆空间', description: '记忆空间与条目浏览（M2）' }) : null,
        tab === 'maintenance' ? h(Placeholder, { title: '维护', description: '衰减、重嵌、人格维护（M2）' }) : null,
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
