from odoo import http
from odoo.http import request


class EaDeskController(http.Controller):

    @http.route('/ea_desk/template/<int:template_id>/download', type='http', auth='user')
    def download_template(self, template_id):
        # Reading through the ORM applies the user's access rights.
        template = request.env['ea.product.template'].browse(template_id).exists()
        if not template:
            return request.not_found()
        filename = f"{template.code or template.name}.md".replace(' ', '_')
        return request.make_response(template.body or '', headers=[
            ('Content-Type', 'text/markdown; charset=utf-8'),
            ('Content-Disposition', http.content_disposition(filename)),
        ])

    @http.route('/ea_desk/document/<int:artifact_id>/download', type='http', auth='user')
    def download_document(self, artifact_id):
        artifact = request.env['ea.artifact'].browse(artifact_id).exists()
        if not artifact or not artifact.doc_body:
            return request.not_found()
        filename = f"{(artifact.document_code or artifact.name).replace('/', '-')}_v{artifact.doc_version}.md"
        return request.make_response(artifact.doc_body, headers=[
            ('Content-Type', 'text/markdown; charset=utf-8'),
            ('Content-Disposition', http.content_disposition(filename)),
        ])
