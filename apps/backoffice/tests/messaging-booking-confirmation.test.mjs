import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'


const uiSource = await readFile(
  new URL('../composables/useMessagingUi.ts', import.meta.url),
  'utf8',
)
const compiledUi = ts.transpileModule(uiSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { useMessagingUi } = await import(
  `data:text/javascript;base64,${Buffer.from(compiledUi).toString('base64')}`
)
const smsPanelSource = await readFile(
  new URL('../components/messaging/SmsCampaignsPanel.vue', import.meta.url),
  'utf8',
)
const campaignEditorSource = await readFile(
  new URL('../pages/messaging/index.vue', import.meta.url),
  'utf8',
)
const campaignWizardSource = await readFile(
  new URL('../pages/messaging/campaigns/new.vue', import.meta.url),
  'utf8',
)


test('booking confirmation preview renders both configurable activity links', () => {
  const {
    variables,
    sampleClient,
    interpolateMessage,
    bookingActivityVariableNames,
    missingTemplateVariables,
  } = useMessagingUi()
  const body = [
    'Ви записані до {master_name} о {appointment_time}.',
    'Переглянути: {manage_url}',
    'Скасувати: {cancel_url}',
  ].join('\n')

  assert.ok(variables.includes('{manage_url}'))
  assert.ok(variables.includes('{cancel_url}'))
  assert.deepEqual(missingTemplateVariables(body, bookingActivityVariableNames), [])
  assert.deepEqual(
    missingTemplateVariables('Переглянути: {manage_url}', bookingActivityVariableNames),
    ['cancel_url'],
  )
  assert.deepEqual(
    missingTemplateVariables(
      'Переглянути: {{ manage_url }} Скасувати: #cancel_url',
      bookingActivityVariableNames,
    ),
    [],
  )
  assert.equal(interpolateMessage(body, sampleClient), [
    'Ви записані до Андрій о 15:30.',
    'Переглянути: https://soulcuts.com.ua/booking/manage#secure-link',
    'Скасувати: https://soulcuts.com.ua/booking/cancel#secure-link',
  ].join('\n'))
})


test('all backoffice booking confirmation editors require managed links', () => {
  assert.match(smsPanelSource, /Переглянути: \{manage_url\}\\nСкасувати: \{cancel_url\}/)
  assert.match(smsPanelSource, /requiredMissingVariables\.length > 0/)
  assert.match(campaignEditorSource, /campaignEditorRequiredMissingVariables\.length > 0/)
  assert.match(campaignWizardSource, /form\.type === 'booking_confirmation' && form\.channel === 'sms'/)
})
