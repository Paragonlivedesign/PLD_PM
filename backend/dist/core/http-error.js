export class HttpError extends Error {
    status;
    code;
    field;
    details;
    constructor(status, code, message, field, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
        this.details = details;
    }
}
