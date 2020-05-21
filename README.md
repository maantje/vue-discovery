# Vue discovery 🔭

This extension discovers Vue components in your workspace and provides intellisens for them. Just starting typing your
component name and press enter to automatically import, register and expand any required props.

<img src="images/overview_o.gif" width="680">

## ✨ Features

* Provide intellisens for components in template section
<img src="images/show-components.gif" width="680">

* Automatically import, register and expand required props
<img src="images/auto-import.gif" width="680">

* Provide intellisens for props on components
<img src="images/show-available-props.gif" width="680">

* Show available props on hover
<img src="images/show-props-on-hover.gif" width="680">

* Uses your defined paths in `jsconfig.json`
<img src="images/uses-paths.gif" width="680">

* Import with `cmd + i`, this is useful for importing pasted components
<img src="images/import-keybind.gif" width="680">


## 🔧 Extension Settings

This extension can be customized with the following settings:

* `vueDiscovery.rootDirectory`: this tells where to look for vue components (default: `src`)
* `vueDiscovery.componentCase`: The casing for the component, available options are `kebab` for kebab-case and `pascal` for PascalCase (default: `pascal`)
* `vueDiscovery.addTrailingComma`: Add a trailing comma to the registered component (default: `true`)
* `vueDiscovery.propCase`: The casing for the props, available options are `kebab` for kebab-case and `camel` for camelCase (default: `kebab`)

## 🔖 Release Notes

### 1.0.0

Initial release of Vue discovery
