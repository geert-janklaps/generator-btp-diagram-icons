"use strict";
const Generator = require("yeoman-generator");
const chalk = require("chalk");
const yosay = require("yosay");

const { createSVGWindow } = require("svgdom");
const { SVG, registerWindow } = require("@svgdotjs/svg.js");

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(
        `Welcome to the ${chalk.red(
          "SAP Business Technology Platform (BTP) diagram icon generator"
        )} !`
      )
    );

    const prompts = [
      {
        type: "confirm",
        name: "circle",
        message: "Do you want to generate circled icons?",
        default: true
      },
      {
        type: "confirm",
        name: "groupbycategory",
        message: "Do you want to group icons by category?",
        default: true
      }
    ];

    return this.prompt(prompts).then(props => {
      // To access props later use this.props.someAnswer;
      this.props = props;
    });
  }

  async writing() {
    const { got } = await import("got");

    // Get BTP services
    let btpServices = await got
      .get(
        "https://discovery-center.cloud.sap/servicecatalog/Services?$orderby=Category,AdditionalCategories",
        { responseType: "json" }
      )
      .json();

    // Get icons (returns promise)
    btpServices = await btpServices.d.results.map(async element => {
      let svg = await got.get(element.Icon).then(response => {
        return response;
      });

      element.extension = element.Icon.substr(
        element.Icon.lastIndexOf(".") + 1
      );

      element.Category = element.Category.replaceAll("/", "-");
      element.filename = element.Name.replaceAll("/", "")
        .replaceAll(" ", "-")
        .replaceAll(",", "-");
      element.svg = svg.body;
      element.binary = svg.rawBody;

      return element;
    });

    // Await promises to resolve
    btpServices = await Promise.all(btpServices).then(result => {
      return result;
    });

    // Write files
    btpServices.forEach(element => {
      let path = "";
      console.log(element.Name);

      // If (this.props.circle === true && element.extension === "svg") {
      if (this.props.circle === true) {
        this.generateCircledIcon(element);
      }

      if (this.props.groupbycategory === true) {
        path = `regular/${element.Category}/${element.filename}.${element.extension}`;
      } else {
        path = `regular/${element.filename}.${element.extension}`;
      }

      this.fs.write(this.destinationPath(path), element.svg);
    });
  }

  generateCircledIcon(service) {
    let svg;
    let path = "";

    if (service === undefined) {
      return;
    }

    // Remove potential doctype declaration
    svg = service?.svg.substring(service?.svg.indexOf("<svg"));

    let window = createSVGWindow();
    let document = window.document;

    // Register window and document
    registerWindow(window, document);

    // Create canvas
    let canvas = SVG(document.documentElement);
    canvas.viewbox(0, 0, 56, 56);

    // Add original icon to canvas (as nested svg)
    let nested = canvas.nested();
    nested.viewbox(0, 0, 56, 56);
    if (service?.extension === "svg") {
      // Embed original svg inside new svg
      nested.svg(svg);
    } else {
      // Embed original icon as base64 encoded string inside the new svg
      let image = nested.image();
      image.attr(
        "xlink:href",
        `data:image/${service?.extension};base64,${service?.binary.toString(
          "base64"
        )}`,
        "http://www.w3.org/1999/xlink"
      );
    }

    nested.height(30);
    nested.x(0).y("25%");

    // Get original svg and set size to 100% (width & height)
    let icon = nested.first();
    icon.height("100%");
    icon.width("100%");

    // Create circle
    canvas
      .circle("46")
      .stroke({ color: "#074d92", opacity: 1, width: 2 })
      // .fill({ color: '#074d92', opacity: 0 })
      .fill("none")
      .center("50%", "50%");

    if (this.props.groupbycategory === true) {
      path = `circled/${service?.Category}/${service?.filename}.svg`;
    } else {
      path = `circled/${service?.filename}.svg`;
    }

    this.fs.write(this.destinationPath(path), canvas.svg());
  }

  install() {
    // This.installDependencies();
  }
};
