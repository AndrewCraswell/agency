export const definitionQuery = `query Definition($type: String!) {
  resource: metaobjectDefinitionByType(type: $type) {
    id type displayNameKey access { storefront }
    capabilities { publishable { enabled } translatable { enabled } renderable { enabled } onlineStore { enabled data { urlHandle } } }
    fieldDefinitions { key required type { name } validations { name value } }
  }
}`
export const fieldDefinitionQuery = `query ProductFieldDefinition($namespace: String!, $key: String!) {
  resources: metafieldDefinitions(ownerType: PRODUCT, namespace: $namespace, key: $key, first: 2) {
    nodes { id namespace key type { name } validations { name value } } pageInfo { hasNextPage }
  }
}`
const entryFields = `id handle type definition { capabilities { onlineStore { enabled data { urlHandle } } } }`
export const entryQuery = `query Entry($handle: MetaobjectHandleInput!) {
  resource: metaobjectByHandle(handle: $handle) { ${entryFields} updatedAt fields { key value } capabilities { publishable { status } } }
}`
export const pagesQuery = `query Pages($query: String!) {
  resources: pages(first: 2, query: $query) { nodes { id handle title body templateSuffix isPublished updatedAt } pageInfo { hasNextPage } }
}`
export const menusQuery = `query Menus($after: String) {
  resources: menus(first: 100, after: $after) {
    nodes { id handle title items { id title type resourceId url tags items { id title type resourceId url tags items { id title type resourceId url tags } } } }
    pageInfo { hasNextPage endCursor }
  }
}`
export const definitionCreate = `mutation DefinitionCreate($input: MetaobjectDefinitionCreateInput!) {
  result: metaobjectDefinitionCreate(definition: $input) { resource: metaobjectDefinition { id type } userErrors { field message } }
}`
export const fieldDefinitionCreate = `mutation FieldDefinitionCreate($input: MetafieldDefinitionInput!) {
  result: metafieldDefinitionCreate(definition: $input) { resource: createdDefinition { id } userErrors { field message } }
}`
export const entryCreate = `mutation EntryCreate($input: MetaobjectCreateInput!) {
  result: metaobjectCreate(metaobject: $input) { resource: metaobject { ${entryFields} } userErrors { field message } }
}`
export const entryUpdate = `mutation EntryUpdate($id: ID!, $input: MetaobjectUpdateInput!) {
  result: metaobjectUpdate(id: $id, metaobject: $input) { resource: metaobject { ${entryFields} } userErrors { field message } }
}`
export const pageCreate = `mutation PageCreate($input: PageCreateInput!) {
  result: pageCreate(page: $input) { resource: page { id handle } userErrors { field message } }
}`
export const pageUpdate = `mutation PageUpdate($id: ID!, $input: PageUpdateInput!) {
  result: pageUpdate(id: $id, page: $input) { resource: page { id handle } userErrors { field message } }
}`
export const menuCreate = `mutation MenuCreate($handle: String!, $title: String!, $items: [MenuItemCreateInput!]!) {
  result: menuCreate(handle: $handle, title: $title, items: $items) { resource: menu { id handle } userErrors { field message } }
}`
export const menuUpdate = `mutation MenuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
  result: menuUpdate(id: $id, title: $title, items: $items) { resource: menu { id handle } userErrors { field message } }
}`
export const filesQuery = `query Files($query: String!) {
  resources: files(first: 2, query: $query) {
    nodes { id fileStatus ... on MediaImage { image { url } } ... on GenericFile { url } } pageInfo { hasNextPage }
  }
}`
export const stageFile = `mutation Stage($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } }
}`
export const createFile = `mutation FileCreate($input: [FileCreateInput!]!) {
  fileCreate(files: $input) { files { id fileStatus } userErrors { field message } }
}`
export const fileStatus = `query FileStatus($id: ID!) {
  node(id: $id) { ... on MediaImage { id fileStatus image { url } } ... on GenericFile { id fileStatus url } }
}`
export const productQuery = `query ProductAssignment($identifier: ProductIdentifierInput!, $namespace: String!, $key: String!) {
  product: productByIdentifier(identifier: $identifier) { id metafield(namespace: $namespace, key: $key) { id type value compareDigest } }
}`
export const setMetafields = `mutation Assign($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) { metafields { id value } userErrors { field message } }
}`
