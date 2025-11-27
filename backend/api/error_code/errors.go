package errors

import "errors"

var (
	ErrNotFound      = errors.New("not found")
	ErrConflict      = errors.New("conflict")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrInvalidInput  = errors.New("invalid input")
	ErrEmailTaken    = errors.New("email already in use")
	ErrWrongPassword = errors.New("wrong password")
	ErrInvalidToken  = errors.New("invalid token")
	ErrBadParamInput = errors.New("params invalid")
)
