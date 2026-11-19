import about from './about'
import siteSettings from './siteSettings'
import gig from './gig'
import project from './project'
import shopItem from './shopItem'
import watchEntry from './watchEntry'
import order from './order'

export const schemaTypes = [about, siteSettings, gig, project, shopItem, watchEntry, order]

export const singletonTypes = new Set(['about', 'siteSettings'])
