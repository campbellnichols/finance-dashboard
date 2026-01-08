"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";

type SankeyNode = {
  name: string;
};

type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

export default function SankeyChart({
  data,
}: {
  data: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
}) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const width = 700;
    const height = 400;

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeWidth(20)
      .nodePadding(20)
      .extent([
        [1, 1],
        [width - 1, height - 1],
      ]);

    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    // Draw links
    svg
      .append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(links)
      .enter()
      .append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", (d: any) => Math.max(1, d.width || 0))
      .attr("opacity", 0.6);

    // Draw nodes
    svg
      .append("g")
      .selectAll("rect")
      .data(nodes)
      .enter()
      .append("rect")
      .attr("x", (d: any) => d.x0!)
      .attr("y", (d) => d.y0!)
      .attr("width", (d) => d.x1! - d.x0!)
      .attr("height", (d) => d.y1! - d.y0!)
      .attr("fill", "#4f46e5");

    // Labels
    svg
      .append("g")
      .style("font", "12px sans-serif")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("x", (d) => (d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6))
      .attr("y", (d) => (d.y0! + d.y1!) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) =>
        d.x0! < width / 2 ? "start" : "end"
      )
      .text((d) => d.name);
  }, [data]);

  return <svg ref={ref} width={700} height={400} />;
}
