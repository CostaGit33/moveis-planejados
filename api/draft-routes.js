const { analyzeDraft, convertDraftToProject } = require('../draft-converter');
const { enrichProject, projectToScene } = require('../hybrid-contract');
const { projectParts } = require('./hybrid-routes');

function registerDraftRoutes(app) {
  app.post('/api/drafts/analyze', (req, res) => {
    try {
      const result = analyzeDraft(req.body || {});
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('POST /api/drafts/analyze error', error.code || error.message);
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });

  app.post('/api/drafts/convert', (req, res) => {
    try {
      const result = convertDraftToProject(req.body || {});
      const project = enrichProject(result.project);
      const parts = projectParts(project);
      const scene = projectToScene(project, parts);
      return res.json({
        ok: true,
        draft: result.draft,
        validation: result.validation,
        project,
        parts,
        scene
      });
    } catch (error) {
      console.error('POST /api/drafts/convert error', error.code || error.message);
      if (error.code === 'DRAFT_INCOMPLETE') {
        return res.status(422).json({ ok: false, error: error.message, validation: error.validation });
      }
      return res.status(400).json({ ok: false, error: error.message || String(error) });
    }
  });
}

module.exports = { registerDraftRoutes };
