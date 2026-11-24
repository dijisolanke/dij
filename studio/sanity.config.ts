import {defineConfig, type DocumentActionComponent, type DocumentActionsContext, type Template} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes, singletonTypes} from './schemaTypes'
import {structure} from './structure'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
if (!projectId) {
  throw new Error(
    'Missing SANITY_STUDIO_PROJECT_ID. Copy studio/.env.example to studio/.env and fill in your Sanity project ID (see studio/README.md).',
  )
}

// Shared by both workspaces below.
const shared = {
  projectId,
  plugins: [structureTool({structure}), visionTool()],
  schema: {
    types: schemaTypes,
    templates: (templates: Template[]) =>
      templates.filter((template) => !singletonTypes.has(template.schemaType)),
  },
  document: {
    // Singletons are edited via the fixed structure entries above, not created/duplicated like normal documents.
    actions: (input: DocumentActionComponent[], context: DocumentActionsContext) =>
      singletonTypes.has(context.schemaType)
        ? input.filter(({action}) => action && !['duplicate', 'delete'].includes(action))
        : input,
  },
}

/**
 * Two workspaces, switchable from the top-left menu in the Studio. Each one's
 * URL path matches its dataset name, so the site's /admin link can open the
 * right one (dijiofficial.com/admin → /production, dev site → /development).
 */
export default defineConfig([
  {
    ...shared,
    name: 'production',
    title: 'Diji — live site',
    subtitle: 'dijiofficial.com · real orders and stock',
    basePath: '/production',
    dataset: 'production',
  },
  {
    ...shared,
    name: 'development',
    title: 'Diji — TEST site',
    subtitle: 'dev.dijiofficial.com · test data only, safe to experiment',
    basePath: '/development',
    dataset: 'development',
  },
])
