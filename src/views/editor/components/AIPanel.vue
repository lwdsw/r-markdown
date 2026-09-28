<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bot, Check, Copy, LoaderCircle, Play, Square, X } from 'lucide-vue-next'
import { createConfiguredAIService } from '@/services/ai/createAIService'
import type { AIResult, AITask } from '@/services/ai/types'
import { getSetting } from '@/config/settings'

const props = defineProps<{ visible: boolean; article: string; selection: string }>()
const emit = defineEmits<{
  close: []
  apply: [content: string, target: 'article' | 'selection' | 'cursor']
  settings: []
  toast: [message: string]
}>()

const task = ref<AITask>('rewrite')
const instruction = ref('')
const result = ref<AIResult | null>(null)
const error = ref('')
const running = ref(false)
let controller: AbortController | null = null

const source = computed(() => props.selection || props.article)
const resultContent = computed(() => result.value?.content ?? result.value?.summary ?? '')

const tasks: Array<{ value: AITask; label: string }> = [
  { value: 'rewrite', label: '润色改写' },
  { value: 'continue', label: '续写' },
  { value: 'summarize', label: '生成摘要' },
  { value: 'outline', label: '整理提纲' },
  { value: 'format', label: '智能排版' },
  { value: 'title', label: '生成标题' },
  { value: 'review', label: '审稿检查' },
  { value: 'compose', label: '从提纲写文章' },
  { value: 'proofread', label: '校对纠错' },
  { value: 'social', label: '跨平台改写' },
  { value: 'cover', label: '封面文案' },
  { value: 'diagram', label: '生成图示' },
]

async function run() {
  if (!source.value.trim()) return
  controller?.abort()
  controller = new AbortController()
  running.value = true
  error.value = ''
  result.value = null
  try {
    const service = createConfiguredAIService()
    result.value = await service.run(
      {
        task: task.value,
        content: source.value,
        instruction: instruction.value.trim() || undefined,
        guidelines: getSetting<string>('aiGuidelines').trim() || undefined,
      },
      controller.signal,
    )
  } catch (cause) {
    if ((cause as DOMException).name !== 'AbortError') {
      error.value = cause instanceof Error ? cause.message : 'AI 请求失败'
    }
  } finally {
    running.value = false
  }
}

function cancel() {
  controller?.abort()
  running.value = false
}

async function copyResult() {
  if (!resultContent.value) return
  await navigator.clipboard.writeText(resultContent.value)
  emit('toast', 'AI 结果已复制')
}
</script>

<template>
  <aside
    v-if="visible"
    class="absolute inset-y-0 right-0 z-40 flex w-[min(420px,100%)] flex-col border-l border-[#e5e7eb] bg-white shadow-xl dark:border-[#333] dark:bg-[#1d1d1f]"
  >
    <header
      class="flex h-12 shrink-0 items-center gap-2 border-b border-[#eee] px-4 dark:border-[#333]"
    >
      <Bot :size="17" />
      <strong class="text-sm">AI 助手</strong>
      <span class="ml-auto text-xs text-[#888]">
        {{ selection ? '处理选区' : '处理全文' }}
      </span>
      <button class="p-1" title="关闭" @click="emit('close')"><X :size="17" /></button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <select
        v-model="task"
        class="h-9 rounded border border-[#ddd] bg-transparent px-2 text-sm dark:border-[#444]"
      >
        <option v-for="item in tasks" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
      <textarea
        v-model="instruction"
        rows="3"
        class="resize-y rounded border border-[#ddd] bg-transparent p-2 text-sm dark:border-[#444]"
        placeholder="补充要求（可选）"
      />
      <div class="flex gap-2">
        <button
          class="flex h-9 items-center gap-1.5 rounded bg-[var(--accent)] px-3 text-sm text-white disabled:opacity-50"
          :disabled="running || !source.trim()"
          @click="run"
        >
          <LoaderCircle v-if="running" :size="15" class="animate-spin" />
          <Play v-else :size="15" />
          执行
        </button>
        <button v-if="running" class="flex h-9 items-center gap-1 px-2 text-sm" @click="cancel">
          <Square :size="14" />停止
        </button>
        <button class="ml-auto text-xs text-[var(--accent)]" @click="emit('settings')">
          AI 设置
        </button>
      </div>

      <p v-if="error" class="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/30">
        {{ error }}
      </p>

      <template v-if="result">
        <div v-if="result.titles?.length" class="space-y-2">
          <button
            v-for="title in result.titles"
            :key="title"
            class="block w-full rounded border border-[#ddd] p-2 text-left text-sm dark:border-[#444]"
            @click="emit('apply', title, 'cursor')"
          >{{ title }}</button>
        </div>
        <div v-if="resultContent" class="rounded border border-[#ddd] dark:border-[#444]">
          <div class="flex items-center border-b border-[#eee] px-2 py-1.5 text-xs dark:border-[#444]">
            生成结果
            <button class="ml-auto p-1" title="复制" @click="copyResult">
              <Copy :size="14" />
            </button>
          </div>
          <pre class="max-h-80 overflow-auto whitespace-pre-wrap p-3 text-xs leading-6">{{
            resultContent
          }}</pre>
        </div>
        <details v-if="resultContent" class="text-xs">
          <summary class="cursor-pointer text-[#666] dark:text-[#aaa]">对照原文</summary>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <div class="min-w-0 rounded bg-red-50 p-2 dark:bg-red-950/20">
              <strong class="text-red-600">原文</strong>
              <pre class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{{ source }}</pre>
            </div>
            <div class="min-w-0 rounded bg-emerald-50 p-2 dark:bg-emerald-950/20">
              <strong class="text-emerald-600">AI 结果</strong>
              <pre class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{{ resultContent }}</pre>
            </div>
          </div>
        </details>
        <div v-if="result.issues?.length" class="space-y-2">
          <div
            v-for="(issue, index) in result.issues"
            :key="index"
            class="rounded border border-amber-300 p-2 text-xs"
          >
            <strong>{{ issue.message }}</strong>
            <p v-if="issue.suggestion" class="mt-1 text-[#777]">{{ issue.suggestion }}</p>
          </div>
        </div>
        <details v-if="result.changes?.length" class="text-xs">
          <summary class="cursor-pointer text-[#666] dark:text-[#aaa]">
            查看 {{ result.changes.length }} 处修改说明
          </summary>
          <div
            v-for="(change, index) in result.changes"
            :key="index"
            class="mt-2 border-l-2 border-[var(--accent)] pl-2"
          >
            <p v-if="change.reason">{{ change.reason }}</p>
            <p v-if="change.original" class="mt-1 text-red-500 line-through">
              {{ change.original }}
            </p>
            <p v-if="change.replacement" class="mt-1 text-emerald-600">
              {{ change.replacement }}
            </p>
          </div>
        </details>
        <p v-for="warning in result.warnings" :key="warning" class="text-xs text-amber-600">
          {{ warning }}
        </p>
        <div v-if="resultContent" class="flex gap-2 border-t border-[#eee] pt-3 dark:border-[#333]">
          <button
            class="flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-2 text-xs text-white"
            @click="emit('apply', resultContent, selection ? 'selection' : 'article')"
          >
            <Check :size="14" />{{ selection ? '替换选区' : '替换全文' }}
          </button>
          <button
            class="rounded border border-[#ddd] px-3 py-2 text-xs dark:border-[#444]"
            @click="emit('apply', resultContent, 'cursor')"
          >
            插入光标处
          </button>
        </div>
      </template>
    </div>
  </aside>
</template>
