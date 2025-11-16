# Init kubernetes

## Start k8s en srv

First apply backend manifests

- Need apply manifest of folders backend
- First apply all manifests of backend like: `kubectl apply -f [1|2|3]*.yaml` Starting with 1 (must apply manifest in order)

Later apply frontend manifests

- Need apply manifest of folders frontend
- First apply all manifests of frontend like: `kubectl apply -f [1|2|3]*.yaml` Starting with 1 (must apply manifest in order)

## Steps to start from zero

- Clone this repo
- helm install . --generate-name --namespace [develop, qa, master] --create-namespace

## Steps to update

- Pull this repo
- 