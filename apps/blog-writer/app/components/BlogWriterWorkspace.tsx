export type BlogWriterWorkspaceProps = {
  isGenerating?: boolean
}

export function BlogWriterWorkspace({ isGenerating = false }: BlogWriterWorkspaceProps) {
  return (
    <s-page heading="SEO blog writer">
      <s-button slot="primary-action" variant="primary" loading={isGenerating || undefined}>
        Generate draft
      </s-button>

      <s-section heading="Article brief">
        <s-stack direction="block" gap="base">
          <s-select label="Destination blog" name="blogId" value="journal">
            <s-option value="journal">Journal</s-option>
          </s-select>
          <s-text-field label="Article title" name="title" value="A practical guide to choosing trail shoes" />
          <s-text-area
            label="Writing brief"
            name="brief"
            value="Help first-time trail runners compare terrain, fit, and cushioning before choosing a shoe."
            rows={5}
          />
        </s-stack>
      </s-section>

      <s-section heading="Draft">
        <s-paragraph>Your generated article will appear here for review before it is saved to Shopify.</s-paragraph>
      </s-section>
    </s-page>
  )
}
